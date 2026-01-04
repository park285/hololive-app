use crate::models::{Stream, StreamListResponse};

use super::{ApiClient, ApiError, ApiResult};

impl ApiClient {
    pub async fn get_live_streams(&self) -> ApiResult<Vec<Stream>> {
        let resp = self
            .get_json::<StreamListResponse>("/api/holo/streams/live")
            .await?;

        if resp.status != "ok" {
            return Err(ApiError::InvalidResponse(format!(
                "unexpected status: {}",
                resp.status
            )));
        }

        Ok(resp.streams)
    }

    /// 예정 스트림 조회
    ///
    /// # Arguments
    /// * `hours` - 조회할 시간 범위 (기본값: 24시간). None이면 백엔드 기본값(24) 사용.
    ///
    /// # Example
    /// ```ignore
    /// // 기본 24시간 조회
    /// let streams = client.get_upcoming_streams(None).await?;
    /// // 48시간 조회
    /// let streams = client.get_upcoming_streams(Some(48)).await?;
    /// ```
    pub async fn get_upcoming_streams(&self, hours: Option<u32>) -> ApiResult<Vec<Stream>> {
        let path = hours.map_or_else(
            || "/api/holo/streams/upcoming".to_string(),
            |h| format!("/api/holo/streams/upcoming?hours={h}"),
        );

        let resp = self.get_json::<StreamListResponse>(&path).await?;

        if resp.status != "ok" {
            return Err(ApiError::InvalidResponse(format!(
                "unexpected status: {}",
                resp.status
            )));
        }

        Ok(resp.streams)
    }
}
