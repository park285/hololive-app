use reqwest::{Client, Url};
use serde::de::DeserializeOwned;
use std::time::Duration;

use super::{ApiError, ApiResult};

/// 기본 API Key (하드코딩, 실제 프로덕션에서는 환경변수나 설정에서 로드해야 함)
const DEFAULT_API_KEY: &str = "w3bAhMIQR8JrHVkGq4kIOaGj7xhVQ+Xdvohy+XjPyeM=";

/// hololive-kakao-bot-go Admin API 클라이언트
#[derive(Clone)]
pub struct ApiClient {
    base_url: Url,
    api_key: String,
    client: Client,
}

impl ApiClient {
    /// `base_url` 예: <https://api.capu.blog>
    pub fn new(base_url: &str) -> ApiResult<Self> {
        Self::with_api_key(base_url, DEFAULT_API_KEY)
    }

    /// API Key를 직접 지정하여 클라이언트 생성
    pub fn with_api_key(base_url: &str, api_key: &str) -> ApiResult<Self> {
        let base_url = Url::parse(base_url).map_err(|e| ApiError::InvalidBaseUrl(e.to_string()))?;

        let client = Client::builder()
            .user_agent("hololive-notifier/0.1")
            .timeout(Duration::from_secs(10))
            .build()?;

        Ok(Self {
            base_url,
            api_key: api_key.to_string(),
            client,
        })
    }

    pub(super) async fn get_json<T: DeserializeOwned>(&self, path: &str) -> ApiResult<T> {
        let url = self
            .base_url
            .join(path)
            .map_err(|e| ApiError::InvalidBaseUrl(e.to_string()))?;

        let resp = self
            .client
            .get(url)
            .header("X-API-Key", &self.api_key)
            .send()
            .await?;
        let status = resp.status();
        let body = resp.text().await?;

        if !status.is_success() {
            let message = extract_error_message(&body).unwrap_or(body);
            return Err(ApiError::HttpStatus {
                status: status.as_u16(),
                message,
            });
        }

        serde_json::from_str::<T>(&body)
            .map_err(|e| ApiError::InvalidResponse(format!("{e} (body={body})")))
    }
}

fn extract_error_message(body: &str) -> Option<String> {
    #[derive(serde::Deserialize)]
    struct ErrorBody {
        error: Option<String>,
        message: Option<String>,
    }

    serde_json::from_str::<ErrorBody>(body)
        .ok()
        .and_then(|parsed| parsed.error.or(parsed.message))
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;

    #[test]
    fn test_new_rejects_invalid_base_url() {
        match ApiClient::new("not-a-url") {
            Ok(_) => panic!("expected invalid base url error"),
            Err(err) => assert!(matches!(err, ApiError::InvalidBaseUrl(_))),
        }
    }

    #[tokio::test]
    async fn test_get_live_streams_success() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET).path("/api/holo/streams/live");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                      "status": "ok",
                      "streams": [
                        {
                          "id": "vid1",
                          "title": "hello",
                          "channelId": "UC123",
                          "channelName": "ch",
                          "status": "upcoming",
                          "startScheduled": "2026-01-01T00:00:00Z"
                        }
                      ]
                    }"#,
                );
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let streams = client.get_live_streams().await.unwrap();

        mock.assert();
        assert_eq!(streams.len(), 1);
        assert_eq!(streams[0].id, "vid1");
        assert_eq!(streams[0].channel_id, "UC123");
    }

    #[tokio::test]
    async fn test_get_json_returns_http_status_error_with_message() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET).path("/api/holo/streams/upcoming");
            then.status(500)
                .header("content-type", "application/json")
                .body(r#"{"message":"boom"}"#);
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let err = client.get_upcoming_streams(None).await.unwrap_err();

        mock.assert();
        match err {
            ApiError::HttpStatus { status, message } => {
                assert_eq!(status, 500);
                assert_eq!(message, "boom");
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn test_get_live_streams_rejects_unexpected_status_field() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET).path("/api/holo/streams/live");
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"status":"fail","streams":[]}"#);
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let err = client.get_live_streams().await.unwrap_err();

        mock.assert();
        assert!(matches!(err, ApiError::InvalidResponse(_)));
    }

    #[tokio::test]
    async fn test_get_json_rejects_invalid_json_body() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET).path("/api/holo/members");
            then.status(200)
                .header("content-type", "application/json")
                .body("not-json");
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let err = client.get_members().await.unwrap_err();

        mock.assert();
        match err {
            ApiError::InvalidResponse(message) => assert!(message.contains("body=")),
            other => panic!("unexpected error: {other:?}"),
        }
    }
}
