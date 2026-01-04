/// 프로필 API - Hololive 멤버 프로필 조회
/// 참고: spec.md 6.1, 6.2
use super::{ApiClient, ApiResult};
use serde::Deserialize;

/// 프로필 정보 (Hololive 공식 사이트 데이터)
#[derive(Debug, Clone, serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    /// URL 슬러그 (예: sakura-miko)
    pub slug: String,
    /// 영문명
    #[serde(default)]
    pub english_name: Option<String>,
    /// 일본어명
    #[serde(default)]
    pub japanese_name: Option<String>,
    /// 캐치프레이즈
    #[serde(default)]
    pub catchphrase: Option<String>,
    /// 설명
    #[serde(default)]
    pub description: Option<String>,
    /// 데이터 엔트리 (생일, 키 등)
    #[serde(default)]
    pub data_entries: Option<Vec<DataEntry>>,
    /// 소셜 링크
    #[serde(default)]
    pub social_links: Option<Vec<SocialLink>>,
    /// 공식 페이지 URL
    #[serde(default)]
    pub official_url: Option<String>,
}

/// 프로필 데이터 엔트리
#[derive(Debug, Clone, serde::Serialize, Deserialize)]
pub struct DataEntry {
    pub label: String,
    pub value: String,
}

/// 소셜 링크
#[derive(Debug, Clone, serde::Serialize, Deserialize)]
pub struct SocialLink {
    pub label: String,
    pub url: String,
}

/// 번역된 프로필 데이터
#[derive(Debug, Clone, serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslatedProfile {
    /// 표시 이름 (로컬라이즈)
    #[serde(default)]
    pub display_name: Option<String>,
    /// 번역된 캐치프레이즈
    #[serde(default)]
    pub catchphrase: Option<String>,
    /// 요약 (한국어)
    #[serde(default)]
    pub summary: Option<String>,
    /// 하이라이트 키워드
    #[serde(default)]
    pub highlights: Option<Vec<String>>,
    /// 번역된 데이터 엔트리
    #[serde(default)]
    pub data: Option<Vec<DataEntry>>,
}

/// 프로필 API 응답
#[derive(Debug, Clone, serde::Serialize, Deserialize)]
pub struct ProfileResponse {
    #[serde(default)]
    pub status: Option<String>,
    pub profile: Option<Profile>,
    pub translated: Option<TranslatedProfile>,
}

impl ApiClient {
    /// 채널 ID로 프로필 조회
    ///
    /// spec.md 6.1: GET `/api/holo/profiles?channelId={CHANNEL_ID}`
    ///
    /// # Example
    /// ```ignore
    /// let profile = client.get_profile_by_channel_id("UC1DCedRgGHBdm81E1llLhOQ").await?;
    /// ```
    pub async fn get_profile_by_channel_id(&self, channel_id: &str) -> ApiResult<ProfileResponse> {
        let path = format!("/api/holo/profiles?channelId={channel_id}");
        self.get_json::<ProfileResponse>(&path).await
    }

    /// 이름으로 프로필 조회
    ///
    /// spec.md 6.2: GET `/api/holo/profiles/name?name={ENGLISH_NAME}`
    ///
    /// # Example
    /// ```ignore
    /// let profile = client.get_profile_by_name("Sakura Miko").await?;
    /// ```
    pub async fn get_profile_by_name(&self, name: &str) -> ApiResult<ProfileResponse> {
        let encoded_name = urlencoding::encode(name);
        let path = format!("/api/holo/profiles/name?name={encoded_name}");
        self.get_json::<ProfileResponse>(&path).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;

    #[tokio::test]
    async fn test_get_profile_by_channel_id_success() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET)
                .path("/api/holo/profiles")
                .query_param("channelId", "UC1DCedRgGHBdm81E1llLhOQ");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                      "status": "ok",
                      "profile": {
                        "slug": "sakura-miko",
                        "english_name": "Sakura Miko",
                        "japanese_name": "さくらみこ",
                        "catchphrase": "Elite Miko!"
                      },
                      "translated": {
                        "display_name": "사쿠라 미코",
                        "catchphrase": "엘리트 미코!"
                      }
                    }"#,
                );
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let resp = client
            .get_profile_by_channel_id("UC1DCedRgGHBdm81E1llLhOQ")
            .await
            .unwrap();

        mock.assert();
        assert!(resp.profile.is_some());
        let profile = resp.profile.unwrap();
        assert_eq!(profile.slug, "sakura-miko");
        assert_eq!(profile.english_name, Some("Sakura Miko".to_string()));
    }

    #[tokio::test]
    async fn test_get_profile_by_name_success() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET)
                .path("/api/holo/profiles/name")
                .query_param("name", "Sakura Miko");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                      "status": "ok",
                      "profile": {
                        "slug": "sakura-miko",
                        "english_name": "Sakura Miko"
                      }
                    }"#,
                );
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let resp = client.get_profile_by_name("Sakura Miko").await.unwrap();

        mock.assert();
        assert!(resp.profile.is_some());
    }

    #[tokio::test]
    async fn test_get_profile_not_found() {
        let server = MockServer::start();

        let mock = server.mock(|when, then| {
            when.method(GET)
                .path("/api/holo/profiles")
                .query_param("channelId", "INVALID");
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"status": "ok", "profile": null}"#);
        });

        let client = ApiClient::new(&server.url("")).unwrap();
        let resp = client.get_profile_by_channel_id("INVALID").await.unwrap();

        mock.assert();
        assert!(resp.profile.is_none());
    }
}
