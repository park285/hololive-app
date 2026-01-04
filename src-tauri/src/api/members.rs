use crate::models::{Member, MemberListResponse};

use super::{ApiClient, ApiResult};

impl ApiClient {
    /// 멤버 목록 조회 (프로필 이미지는 커맨드 레벨에서 캐싱과 함께 처리)
    pub async fn get_members(&self) -> ApiResult<Vec<Member>> {
        let resp = self
            .get_json::<MemberListResponse>("/api/holo/members")
            .await?;

        Ok(resp.members)
    }
}
