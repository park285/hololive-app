/// 채널 API - 프로필 이미지 및 채널 정보 조회
/// 참고: <https://api.capu.blog/api/holo/channels>
use crate::models::Channel;

use super::{ApiClient, ApiResult};
use serde::Deserialize;

/// 단일 채널 조회 응답 (레거시 호환)
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ChannelResponse {
    pub status: Option<String>,
    pub channel: Option<Channel>,
}

/// 배치 채널 조회 응답
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct ChannelsResponse {
    pub status: Option<String>,
    pub channels: Option<Vec<Channel>>,
}

/// 배치 조회 최대 개수 (API 제한)
const MAX_BATCH_SIZE: usize = 100;

impl ApiClient {
    /// 채널 ID로 단일 채널 정보 조회 (프로필 이미지 포함)
    ///
    /// # Example
    /// ```ignore
    /// let channel = client.get_channel("UC1DCedRgGHBdm81E1llLhOQ").await?;
    /// println!("Photo: {:?}", channel.photo);
    /// ```
    pub async fn get_channel(&self, channel_id: &str) -> ApiResult<Option<Channel>> {
        let path = format!("/api/holo/channels?channelId={channel_id}");
        let resp = self.get_json::<ChannelResponse>(&path).await?;
        Ok(resp.channel)
    }

    /// 여러 채널 정보를 배치로 조회
    ///
    /// 새 API 스펙: `channelIds=UC1,UC2,UC3...` 형태로 최대 100개까지 한 번에 조회
    ///
    /// # Example
    /// ```ignore
    /// let channels = client.get_channels_batch(&["UC1...", "UC2..."]).await?;
    /// ```
    pub async fn get_channels_batch(&self, channel_ids: &[String]) -> ApiResult<Vec<Channel>> {
        if channel_ids.is_empty() {
            return Ok(Vec::new());
        }

        // API 제한: 최대 100개
        let ids_to_fetch: Vec<&str> = channel_ids
            .iter()
            .take(MAX_BATCH_SIZE)
            .map(String::as_str)
            .collect();
        let ids_param = ids_to_fetch.join(",");
        let path = format!("/api/holo/channels?channelIds={ids_param}");

        let resp = self.get_json::<ChannelsResponse>(&path).await?;
        Ok(resp.channels.unwrap_or_default())
    }

    /// 여러 채널의 프로필 이미지를 일괄 조회
    ///
    /// 배치 API를 활용하여 단일 요청으로 조회 (최대 100개)
    /// 100개 초과 시 청크 단위로 분할 요청
    pub async fn get_channel_photos(
        &self,
        channel_ids: &[String],
    ) -> std::collections::HashMap<String, String> {
        use std::collections::HashMap;

        if channel_ids.is_empty() {
            return HashMap::new();
        }

        let mut photo_map: HashMap<String, String> = HashMap::with_capacity(channel_ids.len());

        // 100개씩 청크로 분할하여 배치 조회
        for chunk in channel_ids.chunks(MAX_BATCH_SIZE) {
            let chunk_vec: Vec<String> = chunk.to_vec();
            match self.get_channels_batch(&chunk_vec).await {
                Ok(channels) => {
                    for channel in channels {
                        if let Some(photo) = channel.photo {
                            photo_map.insert(channel.id, photo);
                        }
                    }
                }
                Err(e) => {
                    // 배치 조회 실패 시 로그만 남기고 계속 진행
                    tracing::warn!("Batch channel fetch failed: {}", e);
                }
            }
        }

        photo_map
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;

    #[tokio::test]
    async fn test_get_channel_success() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET)
                .path("/api/holo/channels")
                .query_param("channelId", "UC1DCedRgGHBdm81E1llLhOQ");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                      "status": "ok",
                      "channel": {
                        "id": "UC1DCedRgGHBdm81E1llLhOQ",
                        "name": "Pekora Ch. 兎田ぺこら",
                        "english_name": "Usada Pekora",
                        "photo": "https://yt3.ggpht.com/test-photo=s800-c-k-c0x00ffffff-no-rj"
                      }
                    }"#,
                );
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let channel = client
            .get_channel("UC1DCedRgGHBdm81E1llLhOQ")
            .await
            .unwrap();

        mock.assert();
        assert!(channel.is_some());
        let channel = channel.unwrap();
        assert_eq!(channel.id, "UC1DCedRgGHBdm81E1llLhOQ");
        assert!(channel.photo.is_some());
        assert!(channel.photo.unwrap().contains("yt3.ggpht.com"));
    }

    #[tokio::test]
    async fn test_get_channel_not_found() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET)
                .path("/api/holo/channels")
                .query_param("channelId", "INVALID_ID");
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"status": "ok", "channel": null}"#);
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let channel = client.get_channel("INVALID_ID").await.unwrap();

        mock.assert();
        assert!(channel.is_none());
    }

    #[tokio::test]
    async fn test_get_channels_batch_success() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET).path("/api/holo/channels").query_param(
                "channelIds",
                "UC1DCedRgGHBdm81E1llLhOQ,UCdn5BQ06XqgXoAxIhbqw5Rg",
            );
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                      "status": "ok",
                      "channels": [
                        {
                          "id": "UC1DCedRgGHBdm81E1llLhOQ",
                          "name": "Pekora Ch. 兎田ぺこら",
                          "english_name": "Usada Pekora",
                          "photo": "https://yt3.ggpht.com/pekora-photo"
                        },
                        {
                          "id": "UCdn5BQ06XqgXoAxIhbqw5Rg",
                          "name": "Fubuki Ch. 白上フブキ",
                          "english_name": "Shirakami Fubuki",
                          "photo": "https://yt3.ggpht.com/fubuki-photo"
                        }
                      ]
                    }"#,
                );
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let channel_ids = vec![
            "UC1DCedRgGHBdm81E1llLhOQ".to_string(),
            "UCdn5BQ06XqgXoAxIhbqw5Rg".to_string(),
        ];
        let channels = client.get_channels_batch(&channel_ids).await.unwrap();

        mock.assert();
        assert_eq!(channels.len(), 2);
        assert_eq!(channels[0].id, "UC1DCedRgGHBdm81E1llLhOQ");
        assert_eq!(channels[1].id, "UCdn5BQ06XqgXoAxIhbqw5Rg");
    }

    #[tokio::test]
    async fn test_get_channels_batch_empty() {
        let client = ApiClient::new("http://localhost:9999").unwrap();
        let channels = client.get_channels_batch(&[]).await.unwrap();
        assert!(channels.is_empty());
    }
}
