// Member 모델 - Hololive 멤버 정보
// 원본: hololive-kakao-bot-go/internal/domain/member.go

use serde::{Deserialize, Serialize};

/// 멤버 별명 (다국어)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Aliases {
    /// 한국어 별명
    #[serde(default)]
    pub ko: Vec<String>,

    /// 일본어 별명
    #[serde(default)]
    pub ja: Vec<String>,
}

/// Hololive 멤버 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    /// YouTube 채널 ID
    pub channel_id: String,

    /// 공식 이름 (영문)
    pub name: String,

    /// 한국어 이름
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name_ko: Option<String>,

    /// 일본어 이름
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name_ja: Option<String>,

    /// 별명 목록
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aliases: Option<Aliases>,

    /// 졸업 여부 (API에서 isGraduated로 내려옴)
    #[serde(default, alias = "isGraduated")]
    pub graduated: bool,

    /// 그룹 (Myth, Promise, holoX 등)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,

    /// 프로필 사진 URL
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub photo: Option<String>,
}

#[allow(dead_code)]
impl Member {
    /// 표시용 이름 (한국어 > 영문 > 일본어)
    pub fn display_name(&self) -> &str {
        self.name_ko
            .as_deref()
            .or(Some(&self.name))
            .or(self.name_ja.as_deref())
            .unwrap_or(&self.name)
    }

    /// 모든 별명 목록
    pub fn all_aliases(&self) -> Vec<&str> {
        let mut all_aliases = Vec::new();
        if let Some(aliases) = &self.aliases {
            all_aliases.extend(aliases.ko.iter().map(String::as_str));
            all_aliases.extend(aliases.ja.iter().map(String::as_str));
        }
        all_aliases
    }

    /// 검색 쿼리와 매칭 확인
    pub fn matches_query(&self, query: &str) -> bool {
        let query_lower = query.to_lowercase();

        // 이름 매칭
        if self.name.to_lowercase().contains(&query_lower) {
            return true;
        }
        if self
            .name_ko
            .as_ref()
            .is_some_and(|n| n.to_lowercase().contains(&query_lower))
        {
            return true;
        }
        if self
            .name_ja
            .as_ref()
            .is_some_and(|n| n.to_lowercase().contains(&query_lower))
        {
            return true;
        }

        // 별명 매칭
        self.all_aliases()
            .iter()
            .any(|alias| alias.to_lowercase().contains(&query_lower))
    }
}

/// API 응답 래퍼
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberListResponse {
    /// status 필드는 선택적 (멤버 API에는 없음)
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub members: Vec<Member>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_member() -> Member {
        Member {
            channel_id: "UC123".to_string(),
            name: "Mori Calliope".to_string(),
            name_ko: Some("모리 칼리오페".to_string()),
            name_ja: Some("森カリオペ".to_string()),
            aliases: Some(Aliases {
                ko: vec!["칼리".to_string(), "캘리".to_string()],
                ja: vec!["カリ".to_string()],
            }),
            graduated: false,
            group: Some("Myth".to_string()),
            photo: None,
        }
    }

    #[test]
    fn test_display_name_prefers_korean() {
        let member = sample_member();
        assert_eq!(member.display_name(), "모리 칼리오페");

        let member = Member {
            name_ko: None,
            ..sample_member()
        };
        assert_eq!(member.display_name(), "Mori Calliope");
    }

    #[test]
    fn test_all_aliases() {
        let member = sample_member();
        let aliases = member.all_aliases();
        assert_eq!(aliases, vec!["칼리", "캘리", "カリ"]);
    }

    #[test]
    fn test_matches_query_by_name_and_alias() {
        let member = sample_member();

        assert!(member.matches_query("mori"));
        assert!(member.matches_query("MORI"));
        assert!(member.matches_query("칼리오"));
        assert!(member.matches_query("森"));
        assert!(member.matches_query("칼리"));
        assert!(member.matches_query("カリ"));

        assert!(!member.matches_query("not-exists"));
    }

    // === 역직렬화 테스트 ===

    #[test]
    fn test_member_deserialize_with_is_graduated() {
        // API에서 isGraduated로 내려오는 경우 alias로 처리
        let json = r#"{
            "channelId": "UC123",
            "name": "Test Member",
            "isGraduated": true
        }"#;

        let member: Member = serde_json::from_str(json).expect("Failed to deserialize");

        assert_eq!(member.channel_id, "UC123");
        assert_eq!(member.name, "Test Member");
        assert!(member.graduated);
    }

    #[test]
    fn test_member_deserialize_with_graduated() {
        // graduated 필드로 직접 내려오는 경우
        let json = r#"{
            "channelId": "UC456",
            "name": "Active Member",
            "graduated": false
        }"#;

        let member: Member = serde_json::from_str(json).expect("Failed to deserialize");

        assert!(!member.graduated);
    }

    #[test]
    fn test_member_deserialize_defaults() {
        // 최소 필수 필드만 있는 경우 기본값 적용
        let json = r#"{
            "channelId": "UC789",
            "name": "Minimal Member"
        }"#;

        let member: Member = serde_json::from_str(json).expect("Failed to deserialize");

        assert_eq!(member.channel_id, "UC789");
        assert_eq!(member.name, "Minimal Member");
        assert!(!member.graduated); // 기본값 false
        assert!(member.name_ko.is_none());
        assert!(member.name_ja.is_none());
        assert!(member.aliases.is_none());
        assert!(member.group.is_none());
        assert!(member.photo.is_none());
    }

    #[test]
    fn test_member_list_response_deserialize() {
        // API 응답 전체 역직렬화
        let json = r#"{
            "status": "ok",
            "members": [
                {
                    "channelId": "UC1",
                    "name": "Member 1",
                    "nameKo": "멤버 1",
                    "isGraduated": false
                },
                {
                    "channelId": "UC2",
                    "name": "Member 2",
                    "isGraduated": true
                }
            ]
        }"#;

        let response: MemberListResponse =
            serde_json::from_str(json).expect("Failed to deserialize");

        assert_eq!(response.status, Some("ok".to_string()));
        assert_eq!(response.members.len(), 2);
        assert_eq!(response.members[0].name_ko, Some("멤버 1".to_string()));
        assert!(!response.members[0].graduated);
        assert!(response.members[1].graduated);
    }

    #[test]
    fn test_member_list_response_without_status() {
        // status 필드 없이 members만 있는 경우
        let json = r#"{
            "members": [
                {
                    "channelId": "UC1",
                    "name": "Member 1"
                }
            ]
        }"#;

        let response: MemberListResponse =
            serde_json::from_str(json).expect("Failed to deserialize");

        assert!(response.status.is_none());
        assert_eq!(response.members.len(), 1);
    }

    // === Edge case 테스트 ===

    #[test]
    fn test_all_aliases_empty() {
        // aliases가 None인 경우
        let member = Member {
            aliases: None,
            ..sample_member()
        };

        assert!(member.all_aliases().is_empty());
    }

    #[test]
    fn test_all_aliases_partial() {
        // ko만 있고 ja는 빈 경우
        let member = Member {
            aliases: Some(Aliases {
                ko: vec!["별명".to_string()],
                ja: vec![],
            }),
            ..sample_member()
        };

        let aliases = member.all_aliases();
        assert_eq!(aliases.len(), 1);
        assert_eq!(aliases[0], "별명");
    }

    #[test]
    fn test_display_name_fallback_chain() {
        // name_ko도 없고 name_ja만 있는 경우 → name 반환
        let member = Member {
            name_ko: None,
            name_ja: Some("日本語名".to_string()),
            ..sample_member()
        };

        // 현재 로직: name_ko → name → name_ja 순서
        // name_ko가 없으면 name 반환
        assert_eq!(member.display_name(), "Mori Calliope");
    }

    #[test]
    fn test_matches_query_case_insensitive() {
        let member = sample_member();

        // 대소문자 무시
        assert!(member.matches_query("CALLIOPE"));
        assert!(member.matches_query("calliope"));
        assert!(member.matches_query("CaLLiOpE"));
    }

    #[test]
    fn test_matches_query_partial() {
        let member = sample_member();

        // 부분 매칭
        assert!(member.matches_query("Mor"));
        assert!(member.matches_query("ope"));
        assert!(member.matches_query("리오"));
    }
}
