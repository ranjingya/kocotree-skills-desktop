/// 配置 Tauri 构建流程，并声明桌面图标为构建输入。
///
/// 参数：无。
/// 返回值：无；构建失败由 Tauri 构建脚本直接终止进程。
fn main() {
    println!("cargo:rerun-if-changed=icons/32x32.png");
    println!("cargo:rerun-if-changed=icons/128x128.png");
    println!("cargo:rerun-if-changed=icons/128x128@2x.png");
    println!("cargo:rerun-if-changed=icons/icon.icns");
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}
