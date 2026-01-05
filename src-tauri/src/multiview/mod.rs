// Multiview 핵심 비즈니스 로직 모듈
// 레이아웃 인코딩/디코딩, 프리셋 관리, 유효성 검증

pub mod encoding;
pub mod presets;
pub mod validation;

pub use encoding::{decode_layout, encode_layout};
pub use presets::get_builtin_presets;
pub use validation::validate_layout;
