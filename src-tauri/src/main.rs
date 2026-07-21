// 防止 Windows 发布版本额外显示控制台窗口，请勿删除。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kocotree_skills_desktop_lib::run()
}
