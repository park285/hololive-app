// 외부 API 클라이언트 모듈
// hololive-kakao-bot-go의 admin API(/api/holo) 호출용

mod channels;
mod client;
mod error;
mod members;
pub mod profiles;
mod streams;

pub use client::ApiClient;
pub use error::{ApiError, ApiResult};
