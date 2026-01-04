// 백그라운드 스케줄러
// - 설정 폴링 주기(polling_interval_seconds)로 주기적으로 예정 스트림을 조회
// - 로컬 알람(DB)과 매칭되는 스트림이 임박하면 네이티브 알림 발송
// - 이미 알림을 보낸 스트림은 notification_history로 중복 방지
// - notification_history의 start_scheduled_at과 비교하여 일정 변경 감지/알림
// - 매일 7일 이상 된 알림 히스토리 자동 정리

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;

use tauri::Runtime;
#[cfg(not(target_os = "windows"))]
use tauri_plugin_notification::NotificationExt;
use tracing::{info, warn};

use crate::api::ApiClient;
use crate::db::Database;
use crate::models::{Alarm, NotificationHistory, Settings, Stream};

const DEFAULT_POLLING_SECONDS: u64 = 60;
const MIN_POLLING_SECONDS: u64 = 10;
/// 히스토리 정리 주기 (틱 횟수, 약 24시간)
const CLEANUP_EVERY_TICKS: u32 = 1440;
/// 히스토리 보관 기간 (일)
const HISTORY_RETENTION_DAYS: i64 = 7;

/// 정리 카운터 (tick마다 증가)
static TICK_COUNT: AtomicU32 = AtomicU32::new(0);

/// 스케줄러 상태 (클라이언트 캐싱)
struct SchedulerState {
    api_client: Option<ApiClient>,
    cached_base_url: String,
}

impl SchedulerState {
    #[allow(clippy::missing_const_for_fn)]
    fn new() -> Self {
        Self {
            api_client: None,
            cached_base_url: String::new(),
        }
    }

    /// API 클라이언트 가져오기 (설정 변경 시 재생성)
    fn get_client(&mut self, base_url: &str) -> Option<&ApiClient> {
        if self.cached_base_url != base_url || self.api_client.is_none() {
            match ApiClient::new(base_url) {
                Ok(client) => {
                    self.api_client = Some(client);
                    self.cached_base_url = base_url.to_string();
                }
                Err(e) => {
                    warn!("scheduler_api_client_failed: {e}");
                    return None;
                }
            }
        }
        self.api_client.as_ref()
    }
}

pub fn start<R: Runtime>(app_handle: tauri::AppHandle<R>, db: Database) {
    tauri::async_runtime::spawn(async move {
        info!("scheduler_started");

        // 스케줄러 상태 (클라이언트 캐싱)
        let mut state = SchedulerState::new();

        loop {
            let settings = load_settings(&db);
            let interval_seconds = polling_interval_seconds(settings.polling_interval_seconds);

            tick(&app_handle, &db, &settings, &mut state).await;

            tokio::time::sleep(Duration::from_secs(interval_seconds)).await;
        }
    });
}

fn polling_interval_seconds(configured_seconds: i32) -> u64 {
    u64::try_from(configured_seconds).map_or(DEFAULT_POLLING_SECONDS, |seconds| {
        seconds.max(MIN_POLLING_SECONDS)
    })
}

fn load_settings(db: &Database) -> Settings {
    match db.get_settings() {
        Ok(settings) => settings,
        Err(err) => {
            warn!("scheduler_load_settings_failed: {err}");
            Settings::default()
        }
    }
}

async fn tick<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    db: &Database,
    settings: &Settings,
    state: &mut SchedulerState,
) {
    // 정기 히스토리 정리 (약 24시간마다)
    maybe_cleanup_history(db);

    let enabled_alarms = match db.get_enabled_alarms() {
        Ok(alarms) => alarms,
        Err(err) => {
            warn!("scheduler_get_enabled_alarms_failed: {err}");
            return;
        }
    };

    if enabled_alarms.is_empty() {
        return;
    }

    // HashMap 사전 할당으로 메모리 효율성 향상
    let mut alarms_by_channel = HashMap::with_capacity(enabled_alarms.len());
    for alarm in enabled_alarms {
        alarms_by_channel.insert(alarm.channel_id.clone(), alarm);
    }

    let Some(api_client) = state.get_client(&settings.api_base_url) else {
        return;
    };

    let upcoming_streams = match api_client.get_upcoming_streams(None).await {
        Ok(streams) => streams,
        Err(err) => {
            warn!("scheduler_get_upcoming_streams_failed: {err}");
            return;
        }
    };

    for stream in upcoming_streams {
        let Some(alarm) = alarms_by_channel.get(&stream.channel_id) else {
            continue;
        };

        maybe_notify_schedule_change(app_handle, db, alarm, &stream, settings);
        maybe_notify_upcoming(app_handle, db, alarm, &stream, settings);
    }
}

fn maybe_notify_schedule_change<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    db: &Database,
    alarm: &Alarm,
    stream: &Stream,
    settings: &Settings,
) {
    let Some(new_scheduled) = stream.start_scheduled else {
        return;
    };

    let history = match db.get_notification_history(&stream.id) {
        Ok(value) => value,
        Err(err) => {
            warn!("scheduler_get_notification_history_failed: {err}");
            return;
        }
    };
    let Some(history) = history else {
        return;
    };

    let Some(change_message) = history.format_schedule_change(Some(new_scheduled)) else {
        return;
    };

    let member_name = &alarm.member_name;
    let stream_title = &stream.title;
    let title = format!("{member_name} 방송 일정 변경");
    let body = format!("{stream_title}\n{change_message}");

    if let Err(err) = send_notification(app_handle, &title, &body, &stream.id) {
        warn!("scheduler_send_schedule_change_notification_failed: {err}");
        return;
    }

    play_sound(settings.notification_sound_path.as_ref());

    if let Err(err) = db.update_schedule_in_history(&stream.id, Some(new_scheduled)) {
        warn!("scheduler_update_schedule_in_history_failed: {err}");
    }
}

fn maybe_notify_upcoming<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    db: &Database,
    alarm: &Alarm,
    stream: &Stream,
    settings: &Settings,
) {
    if alarm.notify_minutes_before <= 0 {
        return;
    }

    if !stream.should_notify(i64::from(alarm.notify_minutes_before)) {
        return;
    }

    let was_notified = match db.was_notified(&stream.id, alarm.notify_minutes_before) {
        Ok(value) => value,
        Err(err) => {
            warn!("scheduler_was_notified_failed: {err}");
            return;
        }
    };
    if was_notified {
        return;
    }

    let minutes_until_start = stream
        .minutes_until_start()
        .and_then(|mins| i32::try_from(mins).ok())
        .unwrap_or(alarm.notify_minutes_before);

    let member_name = &alarm.member_name;
    let stream_title = &stream.title;
    let notify_minutes_before = alarm.notify_minutes_before;
    let title = format!("{member_name} 방송 {notify_minutes_before}분 전");
    let body = format!("{stream_title}\n시작까지 {minutes_until_start}분");

    if let Err(err) = send_notification(app_handle, &title, &body, &stream.id) {
        warn!("scheduler_send_upcoming_notification_failed: {err}");
        return;
    }

    play_sound(settings.notification_sound_path.as_ref());

    let history = NotificationHistory::new(
        stream.id.clone(),
        stream.start_scheduled,
        alarm.notify_minutes_before,
    );
    if let Err(err) = db.record_notification(&history) {
        warn!("scheduler_record_notification_failed: {err}");
    }
}

/// 알림 발송 - Windows 전용 (winrt-toast-reborn 사용, 클릭 시 YouTube 링크 열기)
#[cfg(target_os = "windows")]
#[allow(clippy::unnecessary_wraps)]
fn send_notification<R: Runtime>(
    _app_handle: &tauri::AppHandle<R>,
    title: &str,
    body: &str,
    video_id: &str,
) -> tauri_plugin_notification::Result<()> {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use winrt_toast_reborn::{Toast, ToastManager};

    let youtube_url = build_youtube_url(video_id);

    // 별도 스레드에서 알림 표시 및 클릭 대기
    let title = title.to_string();
    let body = body.to_string();

    std::thread::spawn(move || {
        let manager = ToastManager::new(ToastManager::POWERSHELL_AUM_ID);

        let mut toast = Toast::new();
        toast.text1(&title).text2(&body);

        let action_taken = Arc::new(AtomicBool::new(false));
        let action_clone = Arc::clone(&action_taken);
        let dismiss_clone = Arc::clone(&action_taken);
        let url_clone = youtube_url.clone();

        let show_result = manager
            .on_activated(None, move |_action| {
                // 알림 본체 클릭 시 URL 열기
                info!("notification_clicked: opening {url_clone}");
                if let Err(e) = open::that(&url_clone) {
                    warn!("notification_open_url_failed: {e}");
                }
                action_clone.store(true, Ordering::SeqCst);
            })
            .on_dismissed(move |_reason| {
                dismiss_clone.store(true, Ordering::SeqCst);
            })
            .on_failed(|e| {
                warn!("notification_failed: {e:?}");
            })
            .show(&toast);

        if let Err(e) = show_result {
            warn!("notification_show_failed: {e}");
        }

        // 알림 이벤트 대기 (최대 15초)
        let start = std::time::Instant::now();
        while start.elapsed() < std::time::Duration::from_secs(15) {
            if action_taken.load(Ordering::SeqCst) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    });

    Ok(())
}

/// 알림 발송 - macOS/Linux 전용 (tauri-plugin-notification 사용, 클릭 처리 미지원)
#[cfg(all(not(target_os = "android"), not(target_os = "windows")))]
fn send_notification<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    title: &str,
    body: &str,
    _video_id: &str,
) -> tauri_plugin_notification::Result<()> {
    // macOS/Linux에서는 클릭 처리 미지원, 단순 알림만 표시
    app_handle
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show()
}

/// 알림 발송 - Android 전용 (tauri-plugin-notification 사용)
#[cfg(target_os = "android")]
fn send_notification<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    title: &str,
    body: &str,
    video_id: &str,
) -> tauri_plugin_notification::Result<()> {
    let youtube_url = build_youtube_url(video_id);

    app_handle
        .notification()
        .builder()
        .title(title)
        .body(body)
        .action_type_id("stream-notification")
        .extra("videoId", video_id)
        .extra("youtubeUrl", &youtube_url)
        .show()
}

/// 사운드 재생 (Desktop 전용 - rodio 사용)
#[cfg(not(target_os = "android"))]
pub fn play_sound(sound_path: Option<&String>) {
    let Some(path) = sound_path.filter(|p| !p.is_empty()) else {
        return;
    };

    // 소유권 이전을 위해 clone (스레드로 전달)
    let path = path.clone();

    std::thread::spawn(move || {
        use rodio::{Decoder, OutputStreamBuilder, Sink};
        use std::fs::File;
        use std::io::BufReader;

        // 오디오 장치 스트림 생성 (rodio 0.21 API)
        let stream = match OutputStreamBuilder::open_default_stream() {
            Ok(s) => s,
            Err(e) => {
                warn!("play_sound_output_stream_error: {e}");
                return;
            }
        };

        let file = match File::open(&path) {
            Ok(f) => f,
            Err(e) => {
                warn!("play_sound_file_error: {path} - {e}");
                return;
            }
        };

        let source = match Decoder::new(BufReader::new(file)) {
            Ok(s) => s,
            Err(e) => {
                warn!("play_sound_decoder_error: {e}");
                return;
            }
        };

        // rodio 0.21: Sink::connect_new() 사용
        let sink = Sink::connect_new(stream.mixer());
        sink.append(source);
        sink.sleep_until_end();
    });
}

/// 사운드 재생 stub (Android - 시스템 알림 사운드 사용)
#[cfg(target_os = "android")]
pub fn play_sound(_sound_path: Option<&String>) {
    // Android에서는 시스템 알림 사운드를 사용하므로 별도 재생 불필요
    // tauri-plugin-notification이 자동으로 시스템 사운드를 재생함
}

/// 정기적으로 오래된 알림 히스토리 정리
fn maybe_cleanup_history(db: &Database) {
    let tick = TICK_COUNT.fetch_add(1, Ordering::Relaxed);

    // CLEANUP_EVERY_TICKS마다 정리 수행 (첫 번째 tick에도 실행하지 않음)
    if tick > 0 && tick.is_multiple_of(CLEANUP_EVERY_TICKS) {
        match db.cleanup_old_notifications(HISTORY_RETENTION_DAYS) {
            Ok(deleted) if deleted > 0 => {
                info!("scheduler_cleanup_history: deleted {deleted} old entries");
            }
            Ok(_) => {}
            Err(err) => {
                warn!("scheduler_cleanup_history_failed: {err}");
            }
        }
    }
}

/// YouTube 비디오 URL 생성
/// 알림 클릭 시 외부 브라우저에서 열기 위한 URL
pub fn build_youtube_url(video_id: &str) -> String {
    format!("https://www.youtube.com/watch?v={video_id}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_polling_interval_seconds_applies_min_and_defaults() {
        assert_eq!(polling_interval_seconds(60), 60);
        assert_eq!(polling_interval_seconds(10), 10);
        assert_eq!(polling_interval_seconds(9), MIN_POLLING_SECONDS);
        assert_eq!(polling_interval_seconds(0), MIN_POLLING_SECONDS);
        assert_eq!(polling_interval_seconds(-1), DEFAULT_POLLING_SECONDS);
    }

    #[test]
    fn test_build_youtube_url_generates_correct_url() {
        // 일반적인 YouTube 비디오 ID
        let url = build_youtube_url("dQw4w9WgXcQ");
        assert_eq!(url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

        // 짧은 ID
        let url = build_youtube_url("abc123");
        assert_eq!(url, "https://www.youtube.com/watch?v=abc123");

        // 특수 문자가 포함된 ID (하이픈, 언더스코어)
        let url = build_youtube_url("abc-_123");
        assert_eq!(url, "https://www.youtube.com/watch?v=abc-_123");
    }

    #[test]
    fn test_build_youtube_url_handles_empty_id() {
        let url = build_youtube_url("");
        assert_eq!(url, "https://www.youtube.com/watch?v=");
    }
}
