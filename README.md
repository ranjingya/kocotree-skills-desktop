# Kocotree Skills

Kocotree Skills 是使用 Tauri 2、React 和 TypeScript 开发的 Skill 浏览、发布与安装客户端。

当前版本使用内存模拟接口，已经支持：

- 匿名浏览、搜索、Tag 筛选和排序。
- Skill 详情、版本历史和原始 `SKILL.md` 预览。
- 模拟飞书登录，以及登录后继续安装或上传操作。
- ZIP 解析后创建 Skill，或为指定 Skill 发布更高版本。
- 模拟指定版本下载、安装成功上报和本地安装状态展示。

真实后端、身份适配器和 Rust 本地安装命令尚未接入。登录协议与令牌生命周期由后续认证接入方提供。上传页面会在前端解析 ZIP，校验文件路径、大小、数量、`SKILL.md` 元数据和内容哈希；页面中的安装不会写入 `~/.agents/skills`。

## 本地运行

安装依赖：

```bash
pnpm install
```

只运行浏览器前端：

```bash
pnpm dev
```

打开 `http://localhost:1420/` 即可调试 React 页面。

运行 Tauri 桌面客户端：

```bash
pnpm tauri dev
```

此命令会同时启动 Vite 开发服务和 Tauri 窗口。浏览器页面与桌面窗口使用同一套 React 前端。

## 开发检查

```bash
pnpm test
pnpm build
```

接口契约更新后重新生成 TypeScript 类型：

```bash
pnpm api:generate
```

接口定义以 [`docs/openapi.yaml`](./docs/openapi.yaml) 为准，产品与流程说明见 [`docs/PRODUCT_DESIGN.md`](./docs/PRODUCT_DESIGN.md)。

## 推荐编辑器配置

- [VS Code](https://code.visualstudio.com/)
- [Tauri 扩展](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer 扩展](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
