use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("Invalid base URL: {0}")]
    InvalidBaseUrl(String),

    #[error("HTTP request error: {0}")]
    Request(#[from] reqwest::Error),

    #[error("Unexpected HTTP status {status}: {message}")]
    HttpStatus { status: u16, message: String },

    #[error("Invalid API response: {0}")]
    InvalidResponse(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

// Tauri 에러 변환
impl Serialize for ApiError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_error_serializes_as_string() {
        let err = ApiError::InvalidBaseUrl("bad".to_string());
        let value = serde_json::to_value(&err).expect("Failed to serialize");
        match value {
            serde_json::Value::String(s) => assert!(s.contains("Invalid base URL")),
            other => panic!("unexpected json: {other:?}"),
        }
    }
}
