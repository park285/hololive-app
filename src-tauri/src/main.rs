// Windows 릴리스 빌드에서 추가 콘솔 창을 방지함, 삭제 금지!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hololive_notifier_lib::run();
}
