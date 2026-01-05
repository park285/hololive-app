import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Vite에서 빌드 시 주입되는 버전 (vite.config.ts의 define 참조)
declare const __APP_VERSION__: string;

// 한국어 번역
const ko = {
    translation: {
        // 네비게이션
        nav: {
            dashboard: '대시보드',
            multiview: '멀티뷰',
            members: '멤버',
            alarms: '알람',
            settings: '설정',
        },

        // 대시보드 페이지
        dashboard: {
            title: '대시보드',
            refresh: '새로고침',
            liveNow: 'Live Now',
            upcoming: 'Upcoming',
            noLive: '현재 라이브 중인 방송이 없습니다.',
            noUpcoming: '예정된 방송이 없습니다.',
            loading: '데이터를 불러오는 중입니다...',
        },

        // 멤버 페이지
        members: {
            title: '멤버 목록',
            searchPlaceholder: '이름, 별명 검색...',
            noResults: '검색 결과가 없습니다.',
            alarmOn: '켜짐',
            alarmOff: '꺼짐',
            graduated: '졸업',
        },

        // 알람 페이지
        alarms: {
            title: '내 알람',
            total: '총 {{count}}개',
            empty: '등록된 알람이 없습니다',
            emptyDesc: '멤버 페이지에서 알람을 등록해보세요.',
            notifyBefore: '방송 {{minutes}}분 전 알림',
            deleteAlarm: '알람 삭제',
        },

        // 설정 페이지
        settings: {
            title: '설정',
            display: '화면 설정',
            themeMode: '테마 모드',
            light: '라이트',
            dark: '다크',
            system: '시스템',
            dataSync: '데이터 동기화',
            updateInterval: '업데이트 주기',
            updateIntervalDesc: '데이터 자동 갱신 간격',
            seconds: '{{count}}초',
            minutes: '{{count}}분',
            language: '언어',
            languageDesc: '앱 표시 언어',
            hideGraduated: '졸업 멤버 숨기기',
            hideGraduatedDesc: '졸업 멤버를 목록에서 숨깁니다',
            notifications: '알림',
            testNotification: '테스트 알림',
            testNotificationDesc: '알림이 정상적으로 작동하는지 확인합니다.',
            sendTestNotification: '알림 보내기',
            notificationSound: '알림음 설정',
            notificationSoundDesc: '알림 발생 시 재생할 오디오 파일 (mp3, wav 등)',
            selectFile: '파일 선택',
            defaultSound: '기본음 사용',
            advancedSettings: '고급 설정',
            clearCache: '데이터 재설정',
            clearCacheDesc: '문제 해결을 위해 저장된 데이터를 지우고 다시 불러옵니다.',
            clearCacheConfirm: '모든 데이터를 다시 받아오시겠습니까? 잠시 시간이 걸릴 수 있습니다.',
        },

        // 스트림 상태
        stream: {
            live: '🔴 라이브',
            upcoming: '예정됨',
            ended: '종료됨',
            startingSoon: '곧 시작',
            viewersCount: '{{count}}명 시청 중',
        },

        // 공통
        common: {
            loading: '로딩 중...',
            loadingMembers: '멤버 정보를 불러오는 중입니다...',
            loadingAlarms: '알람 목록을 불러오는 중입니다...',
            error: '오류가 발생했습니다',
            errorDesc: '데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.',
            retry: '다시 시도',
            noData: '데이터 없음',
            poweredBy: 'Powered by',
        },

        // 시간 표현
        time: {
            inProgress: '진행 중',
            minutesLater: '{{count}}분 후',
            hoursLater: '{{count}}시간 후',
            daysLater: '{{count}}일 후',
            startsAt: '{{time}} 시작',
        },

        // 앱 정보
        app: {
            name: 'Hololive Stream Notifier',
            version: __APP_VERSION__,
        },

        // 인증
        auth: {
            login: '로그인',
            logout: '로그아웃',
            welcome: '환영합니다, {{name}}님',
        },

        // 멀티뷰
        multiview: {
            title: '멀티뷰',
            cellCount: '{{count}}셀',
            activeCount: '{{active}}/{{max}} 활성',
            addCell: '셀 추가',
            addAuto: '자동',
            addAutoDesc: '빈 공간 채우기',
            addSmall: '작게 (2x2)',
            addSmallDesc: '작은 정사각형 (최대 64개)',
            addMedium: '중간 (4x3)',
            addMediumDesc: '일반적인 직사각형 (최대 24개)',
            addLarge: '크게 (6x5)',
            addLargeDesc: '넓은 화면 (최대 16개)',
            editMode: '편집',
            editDone: '완료',
            savePreset: '프리셋 저장',
            savePresetDesc: '현재 레이아웃 구성({{count}}개 셀)을 새로운 프리셋으로 저장합니다.',
            presetNamePlaceholder: '프리셋 이름 입력',
            selectPreset: '프리셋 선택...',
            muteOn: '자동 음소거: 켜짐 (한 번에 하나만 소리 재생)',
            muteOff: '자동 음소거: 꺼짐',
            addStream: '스트림 추가',
            addStreamHint: '클릭하여 방송을 선택하세요',
            enterUrl: 'URL 직접 입력',
            youtubeUrlTitle: 'YouTube URL 입력',
            youtubeUrlDesc: '시청할 비디오의 링크를 붙여넣으세요',
            invalidUrl: '유효한 YouTube URL 또는 Video ID를 입력하세요',
            cancel: '취소',
            confirm: '확인',
            save: '저장',
        },
    },
};

// 영어 번역
const en = {
    translation: {
        // 네비게이션
        nav: {
            dashboard: 'Dashboard',
            multiview: 'Multiview',
            members: 'Members',
            alarms: 'Alarms',
            settings: 'Settings',
        },

        // 대시보드 페이지
        dashboard: {
            title: 'Dashboard',
            refresh: 'Refresh',
            liveNow: 'Live Now',
            upcoming: 'Upcoming',
            noLive: 'No live streams at the moment.',
            noUpcoming: 'No upcoming streams.',
            loading: 'Loading data...',
        },

        // 멤버 페이지
        members: {
            title: 'Members',
            searchPlaceholder: 'Search by name...',
            noResults: 'No results found.',
            alarmOn: 'On',
            alarmOff: 'Off',
            graduated: 'Grad',
        },

        // 알람 페이지
        alarms: {
            title: 'My Alarms',
            total: '{{count}} total',
            empty: 'No alarms registered',
            emptyDesc: 'Add alarms from the Members page.',
            notifyBefore: 'Notify {{minutes}} min before stream',
            deleteAlarm: 'Delete alarm',
        },

        // 설정 페이지
        settings: {
            title: 'Settings',
            display: 'Display',
            themeMode: 'Theme Mode',
            light: 'Light',
            dark: 'Dark',
            system: 'System',
            dataSync: 'Data Sync',
            updateInterval: 'Update Interval',
            updateIntervalDesc: 'Auto-refresh interval',
            seconds: '{{count}}s',
            minutes: '{{count}} min',
            language: 'Language',
            languageDesc: 'App display language',
            hideGraduated: 'Hide Graduated Members',
            hideGraduatedDesc: 'Hide graduated members from the list',
            notifications: 'Notifications',
            testNotification: 'Test Notification',
            testNotificationDesc: 'Check if notifications work correctly.',
            sendTestNotification: 'Send Test',
            notificationSound: 'Notification Sound',
            notificationSoundDesc: 'Audio file to play for notifications (mp3, wav, etc.)',
            selectFile: 'Select File',
            defaultSound: 'Use Default',
            advancedSettings: 'Advanced Settings',
            clearCache: 'Clear Data',
            clearCacheDesc: 'Delete all cached data and reload from server.',
            clearCacheConfirm: 'Are you sure you want to clear all data? It will be reloaded.',
        },

        // 스트림 상태
        stream: {
            live: '🔴 LIVE',
            upcoming: 'Upcoming',
            ended: 'Ended',
            startingSoon: 'Starting Soon',
            viewersCount: '{{count}} watching',
        },

        // 공통
        common: {
            loading: 'Loading...',
            loadingMembers: 'Loading member information...',
            loadingAlarms: 'Loading alarms...',
            error: 'An error occurred',
            errorDesc: 'Failed to load data. Please try again later.',
            retry: 'Retry',
            noData: 'No data',
            poweredBy: 'Powered by',
        },

        // 시간 표현
        time: {
            inProgress: 'In progress',
            minutesLater: 'in {{count}} min',
            hoursLater: 'in {{count}} hr',
            daysLater: 'in {{count}} day(s)',
            startsAt: 'Starts at {{time}}',
        },

        // 앱 정보
        app: {
            name: 'Hololive Stream Notifier',
            version: __APP_VERSION__,
        },

        // 인증
        auth: {
            login: 'Sign in',
            logout: 'Sign out',
            welcome: 'Welcome, {{name}}',
        },

        // 멀티뷰
        multiview: {
            title: 'Multiview',
            cellCount: '{{count}} cells',
            activeCount: '{{active}}/{{max}} active',
            addCell: 'Add cell',
            addAuto: 'Auto',
            addAutoDesc: 'Fill empty space',
            addSmall: 'Small (2x2)',
            addSmallDesc: 'Small square (max 64)',
            addMedium: 'Medium (4x3)',
            addMediumDesc: 'Standard rectangle (max 24)',
            addLarge: 'Large (6x5)',
            addLargeDesc: 'Wide screen (max 16)',
            editMode: 'Edit',
            editDone: 'Done',
            savePreset: 'Save Preset',
            savePresetDesc: 'Save current layout ({{count}} cells) as a new preset.',
            presetNamePlaceholder: 'Enter preset name',
            selectPreset: 'Select preset...',
            muteOn: 'Auto-mute: On (only one audio at a time)',
            muteOff: 'Auto-mute: Off',
            addStream: 'Add stream',
            addStreamHint: 'Click to select a stream',
            enterUrl: 'Enter URL',
            youtubeUrlTitle: 'Enter YouTube URL',
            youtubeUrlDesc: 'Paste the video link to watch',
            invalidUrl: 'Enter a valid YouTube URL or Video ID',
            cancel: 'Cancel',
            confirm: 'OK',
            save: 'Save',
        },
    },
};

// 日本語翻訳
const ja = {
    translation: {
        // 네비게이션
        nav: {
            dashboard: 'ダッシュボード',
            multiview: 'マルチビュー',
            members: 'メンバー',
            alarms: 'アラーム',
            settings: '設定',
        },

        // 대시보드 페이지
        dashboard: {
            title: 'ダッシュボード',
            refresh: '更新',
            liveNow: '配信中',
            upcoming: '配信予定',
            noLive: '現在配信中の枠はありません。',
            noUpcoming: '予定されている配信はありません。',
            loading: 'データを読み込み中...',
        },

        // 멤버 페이지
        members: {
            title: 'メンバー一覧',
            searchPlaceholder: '名前で検索...',
            noResults: '検索結果がありません。',
            alarmOn: 'オン',
            alarmOff: 'オフ',
            graduated: '卒業',
        },

        // 알람 페이지
        alarms: {
            title: 'マイアラーム',
            total: '{{count}}件',
            empty: '登録されたアラームはありません',
            emptyDesc: 'メンバーページからアラームを追加してください。',
            notifyBefore: '配信{{minutes}}分前に通知',
            deleteAlarm: 'アラームを削除',
        },

        // 설정 페이지
        settings: {
            title: '設定',
            display: '表示設定',
            themeMode: 'テーマモード',
            light: 'ライト',
            dark: 'ダーク',
            system: 'システム',
            dataSync: 'データ同期',
            updateInterval: '更新間隔',
            updateIntervalDesc: 'データの自動更新間隔',
            seconds: '{{count}}秒',
            minutes: '{{count}}分',
            language: '言語',
            languageDesc: 'アプリの表示言語',
            hideGraduated: '卒業メンバーを非表示',
            hideGraduatedDesc: '卒業メンバーをリストから非表示にします',
            notifications: '通知',
            testNotification: 'テスト通知',
            testNotificationDesc: '通知が正常に動作するかを確認します。',
            sendTestNotification: 'テストを送信',
            notificationSound: '通知音設定',
            notificationSoundDesc: '通知時に再生する音声ファイル (mp3, wavなど)',
            selectFile: 'ファイル選択',
            defaultSound: 'デフォルトを使用',
            advancedSettings: '詳細設定',
            clearCache: 'データ初期化',
            clearCacheDesc: '保存されたキャッシュデータを削除し、再読み込みします。',
            clearCacheConfirm: '本当にすべてのデータを初期化しますか？データは再ロードされます。',
        },

        // 스트림 상태
        stream: {
            live: '🔴 配信中',
            upcoming: '配信予定',
            ended: '終了',
            startingSoon: 'まもなく開始',
            viewersCount: '{{count}}人視聴中',
        },

        // 공통
        common: {
            loading: '読み込み中...',
            loadingMembers: 'メンバー情報を読み込んでいます...',
            loadingAlarms: 'アラームを読み込んでいます...',
            error: 'エラーが発生しました',
            errorDesc: 'データの取得に失敗しました。しばらくしてからもう一度お試しください。',
            retry: '再試行',
            noData: 'データなし',
            poweredBy: 'Powered by',
        },

        // 시간 표현
        time: {
            inProgress: '配信中',
            minutesLater: '{{count}}分後',
            hoursLater: '{{count}}時間後',
            daysLater: '{{count}}日後',
            startsAt: '{{time}} 開始',
        },

        // 앱 정보
        app: {
            name: 'Hololive Stream Notifier',
            version: __APP_VERSION__,
        },

        // 인증
        auth: {
            login: 'ログイン',
            logout: 'ログアウト',
            welcome: 'ようこそ、{{name}}さん',
        },

        // 멀티뷰
        multiview: {
            title: 'マルチビュー',
            cellCount: '{{count}}セル',
            activeCount: '{{active}}/{{max}} アクティブ',
            addCell: 'セル追加',
            addAuto: '自動',
            addAutoDesc: '空きスペースを埋める',
            addSmall: '小 (2x2)',
            addSmallDesc: '小さい正方形 (最大64個)',
            addMedium: '中 (4x3)',
            addMediumDesc: '標準長方形 (最大24個)',
            addLarge: '大 (6x5)',
            addLargeDesc: 'ワイド画面 (最大16個)',
            editMode: '編集',
            editDone: '完了',
            savePreset: 'プリセット保存',
            savePresetDesc: '現在のレイアウト({{count}}セル)を新しいプリセットとして保存します。',
            presetNamePlaceholder: 'プリセット名を入力',
            selectPreset: 'プリセット選択...',
            muteOn: '自動ミュート: オン (一度に一つだけ音声再生)',
            muteOff: '自動ミュート: オフ',
            addStream: '配信を追加',
            addStreamHint: 'クリックして配信を選択',
            enterUrl: 'URLを入力',
            youtubeUrlTitle: 'YouTube URLを入力',
            youtubeUrlDesc: '視聴する動画のリンクを貼り付けてください',
            invalidUrl: '有効なYouTube URLまたはVideo IDを入力してください',
            cancel: 'キャンセル',
            confirm: 'OK',
            save: '保存',
        },
    },
};

// 지원 언어 목록
export const supportedLanguages = ['ko', 'en', 'ja'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

// 브라우저/시스템 언어 감지 또는 저장된 설정 사용
const getInitialLanguage = (): string => {
    // localStorage에서 저장된 언어 확인
    const savedLang = localStorage.getItem('app-language');
    if (savedLang && supportedLanguages.includes(savedLang as SupportedLanguage)) {
        return savedLang;
    }

    // 브라우저 언어 감지
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'ko') return 'ko';
    if (browserLang === 'ja') return 'ja';
    return 'en';
};

i18n
    .use(initReactI18next)
    .init({
        resources: {
            ko,
            en,
            ja,
        },
        lng: getInitialLanguage(),
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React에서 이미 이스케이프 처리함
        },
    });

// 언어 변경 시 localStorage에 저장
i18n.on('languageChanged', (lng) => {
    localStorage.setItem('app-language', lng);
});

export default i18n;
