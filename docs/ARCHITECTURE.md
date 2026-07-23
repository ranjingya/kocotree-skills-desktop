# Kocotree Skills 架构说明

## 1. 架构目标

Kocotree Skills 同时包含本地 Skill 管理和在线 Skill 平台两个领域。两者共享 Skill 名称、版本和内容哈希等关联信息，但拥有不同的事实来源、可用条件和写入边界。

架构遵循以下原则：

- 本地 Skill 以当前设备的磁盘内容为事实来源。
- 在线 Skill 以服务端 API 返回的数据为事实来源。
- 扫描、查看、备份、恢复和移除本地 Skill 不依赖登录或网络。
- 在线信息只增强本地展示，查询失败不能隐藏、删除或改变本地内容。
- 在线服务不能直接读取或修改用户磁盘；本地服务不能直接修改在线业务数据。
- 平台版本安装由应用协调层编排，本地层和在线层不互相依赖。
- React 页面不直接访问文件系统、Tauri 命令或 HTTP。

## 2. 当前项目基础

架构直接建立在现有代码之上，不要求先重写页面或整体迁移目录。

| 当前模块 | 已承担职责 | 架构归属 |
| --- | --- | --- |
| `src/App.tsx` | 应用外壳、登录拦截、安装确认、下载凭证、本地安装和安装上报编排 | 页面层；其中安装编排迁入 `InstallationService` |
| `src/components/MySkillsPage.tsx` | 本地/在线页签、本地扫描、在线状态补充和展示模型 | 页面层与本地列表用例 |
| `src/components/InstallConfirmModal.tsx`、`src/components/InstallFeedbackModal.tsx` | 安装确认、强制替换提示和安装结果反馈 | 安装流程展示层 |
| `src/api/contracts.ts` | OpenAPI DTO、`SkillApi`、`LocalSkillService` 和本地记录类型 | 在线端口与本地端口定义 |
| `src/api/mockSkillApi.ts` | 在线平台内存模拟 | `SkillApi` 的 Mock 适配器 |
| `src/api/mockLocalSkillService.ts` | 本地扫描、安装、冲突和备份结果模拟 | `LocalSkillService` 的 Mock 适配器 |
| `src/api/index.ts` | 创建并导出共享服务实例 | 应用组合入口 |
| `src/api/skillPackage.ts`、`src/api/zipInspector.ts` | 上传前 ZIP 解析、路径检查、文件清单和哈希 | 客户端包检查规则 |
| `docs/openapi.yaml`、`src/api/schema.d.ts` | 在线 HTTP 契约及生成类型 | 在线领域契约 |
| `src-tauri/src/lib.rs` | Tauri 启动和命令注册入口 | 本地适配器入口 |

### 2.1 已形成的边界

- 页面统一通过 `skillApi` 和 `localSkillService` 访问数据，没有直接导入模拟数据。
- “我的 Skill”已经用本地、在线两个页签表达不同数据来源。
- `SkillApi` 已覆盖在线浏览、发布、下载凭证、在线状态和安装上报。
- `LocalSkillService` 已提供 `scanSkills`、`install` 和 `remove` 三个基础方法。
- `MockSkillApi` 与 `MockLocalSkillService` 可以继续承担浏览器开发和前端回归测试。
- `MySkillsPage` 已把在线状态查询失败显示为附加状态，没有删除本地记录。
- `api/index.ts` 已具备组合入口职责，可以在这里切换 Mock、HTTP 和 Tauri 实现。

### 2.2 需要收敛的耦合

- `LocalInstallRequest` 直接引用 `SkillSummaryDto` 和 `SkillVersionDto`，使本地接口依赖在线 DTO。
- `App.tsx` 直接串联下载凭证、详情查询、本地安装和安装上报，承担了应用服务职责。
- `MySkillsPage` 等待全部在线状态请求完成后才写入本地列表，离线信息会延迟本地首屏。
- `App.tsx` 使用独立的 `installedSkillIds` 状态缓存安装结果，容易与本地扫描结果产生双重事实来源。
- 本地错误和在线错误共同使用 `SkillApiError`，无法从类型上区分文件系统错误与 HTTP 业务错误。
- `contracts.ts` 同时容纳在线 DTO 与本地模型，后续扩展时需要按领域拆分导出。
- Tauri 侧只有示例命令，真实扫描、哈希、安装、凭证和备份命令尚未注册。

这些耦合通过新增协调服务和本地适配器逐步收敛，现有页面、Mock 数据和在线 `SkillApi` 不需要推倒重建。

## 3. 领域划分

### 3.1 本地 Skill 领域

本地领域负责当前设备上的事实和操作：

- 扫描 `~/.agents/skills`。
- 读取并校验 `SKILL.md`。
- 生成规范化文件清单和 `contentHash`。
- 读取与写入安装凭证。
- 判断目录存在、内容一致和本地修改状态。
- 创建、轮换和恢复备份。
- 安全安装、替换和移除 Skill。
- 管理 Codex 通用目录和 Claude 目录链接。

本地领域必须能够在未登录、断网和在线服务异常时独立工作。

### 3.2 在线 Skill 领域

在线领域负责平台上的共享数据和协作规则：

- 浏览、搜索和筛选在线 Skill。
- 查询详情、版本、文件树和平台状态。
- 创建 Skill、发布版本和修改平台信息。
- 管理 Owner、协作者、归档、撤回和所有权转移。
- 签发平台版本下载凭证。
- 通过名称与内容哈希解析平台关联。
- 接收幂等的安装成功事件。

在线领域通过 `SkillApi` 暴露能力。OpenAPI 只描述在线 HTTP 契约，不描述本地文件系统命令。

### 3.3 安装协调领域

安装协调领域负责需要同时使用本地与在线能力的用例：

- 安装或重新安装平台版本。
- 更新到新版本或降级到历史版本。
- 恢复丢失的平台安装凭证。
- 处理同名目录冲突和强制安装确认。
- 安装派生 Skill 后安全替换同一来源链上的旧 Skill。
- 在本地安装成功后上报安装事件。

协调层只负责编排和状态转换，不直接操作文件系统，也不实现服务端业务规则。

### 3.4 身份领域

身份领域负责获取当前用户和 Bearer Token。身份是在线写操作的前置条件，但不是本地 Skill 管理的前置条件。

登录协议、令牌生命周期和飞书身份映射由身份适配器负责，不进入本地安装凭证。

## 4. 分层与依赖方向

```mermaid
flowchart TB
  UI["React 页面与组件"]
  InstallApp["InstallationService"]
  LocalPort["LocalSkillService"]
  OnlinePort["SkillApi"]
  Composition["src/api/index.ts"]
  TauriAdapter["TauriLocalSkillService"]
  HttpAdapter["HttpSkillApi"]
  MockLocal["MockLocalSkillService"]
  MockOnline["MockSkillApi"]
  Rust["Rust 文件系统与平台实现"]
  Server["在线 Skill 服务"]

  UI --> LocalPort
  UI --> OnlinePort
  UI --> InstallApp
  InstallApp --> LocalPort
  InstallApp --> OnlinePort
  Composition -. "创建并注入" .-> LocalPort
  Composition -. "创建并注入" .-> OnlinePort
  Composition -. "创建并注入" .-> InstallApp
  LocalPort --> TauriAdapter
  LocalPort --> MockLocal
  OnlinePort --> HttpAdapter
  OnlinePort --> MockOnline
  TauriAdapter --> Rust
  HttpAdapter --> Server
```

依赖方向固定为“页面 → 应用服务或接口 → 适配器”。现有 `src/api/index.ts` 继续作为组合入口，浏览器开发注入两个 Mock，桌面环境注入 Tauri 本地实现，接入后端时注入 HTTP 在线实现。

## 5. 数据归属

| 数据 | 事实来源 | 持久化位置 | 网络要求 |
| --- | --- | --- | --- |
| Skill 目录与文件内容 | 本地磁盘 | `~/.agents/skills/<skillName>` | 无 |
| 本地内容哈希 | 本地扫描计算 | 扫描结果或安装凭证 | 无 |
| 安装凭证 | 本地安装流程 | `~/.agents/.kocotree/installations/` | 无 |
| 备份 | 本地安装流程 | `~/.agents/.kocotree/backups/` | 无 |
| 在线 Skill、版本和平台信息 | 在线服务 | 服务端 | 有 |
| 归档、名称冲突和撤回状态 | 在线服务 | 服务端 | 有 |
| 本地与在线合并展示模型 | 客户端应用层 | 页面内存 | 在线信息可选 |
| 登录身份和令牌 | 身份适配器 | 由认证接入方定义 | 在线操作需要 |

安装凭证保存平台 `skillId`、`versionId`、版本号、安装路径、安装时的 `contentHash` 和安装时间，不保存用户令牌、在线详情或可变展示文案。

## 6. 本地状态模型

本地文件、凭证一致性、平台关联和在线状态使用四个独立维度表达。

### 6.1 本地文件状态

- `PRESENT`：目录存在并可读取。
- `MISSING`：安装凭证存在，但目录不存在。
- `INVALID`：目录存在，但缺少合法 `SKILL.md` 或无法安全读取。

### 6.2 凭证一致性状态

- `MATCHES_RECEIPT`：实际内容哈希与安装凭证一致。
- `DIFFERS_FROM_RECEIPT`：实际内容哈希与安装凭证不一致。
- `NOT_COMPARABLE`：没有可用于比较的安装凭证。

### 6.3 平台关联状态

- `CREDENTIALED`：存在有效安装凭证。
- `MATCHED`：凭证缺失，但 `skillName + contentHash` 匹配在线历史版本。
- `UNMATCHED`：没有可确认的平台关联。

### 6.4 在线状态

- `ACTIVE`
- `ARCHIVED`
- `NAME_CONFLICT`
- `VERSION_WITHDRAWN`
- `UNAVAILABLE`
- `NOT_QUERIED`

页面标签由四个维度组合得出：

| 展示分类 | 组合条件 |
| --- | --- |
| `PLATFORM_INSTALLED` | 目录存在、凭证存在、实际哈希与凭证一致 |
| `PLATFORM_MODIFIED` | 目录存在、凭证存在、实际哈希与凭证不一致 |
| `PLATFORM_MATCHED` | 目录存在、没有凭证、在线匹配成功 |
| `LOCAL_UNKNOWN` | 目录存在、没有可确认的平台关联 |
| `MISSING` | 凭证存在、目录缺失 |

在线查询失败只把在线状态标记为 `UNAVAILABLE`，不能把本地记录改为 `LOCAL_UNKNOWN`。

`INVALID` 是本地扫描错误，应保留目录路径和错误原因单独展示，不能因为解析失败而忽略该目录。

## 7. 核心接口

### 7.1 LocalSkillService

现有 `LocalSkillService` 名称和调用入口保持不变：

```ts
interface LocalSkillService {
  scanSkills(): Promise<LocalSkillRecord[]>;
  install(input: LocalInstallRequest): Promise<LocalInstallResult>;
  remove(skillName: string): Promise<void>;
}
```

`MockLocalSkillService` 继续实现该接口。真实磁盘能力由新增的 `TauriLocalSkillService` 实现，页面不感知实现差异。

接口按本地能力扩展时遵循以下约束：

- `LocalInstallRequest` 使用包位置、目标名称、目标哈希、本地确认选项和本地关联值对象，不直接接收完整 `SkillSummaryDto` 或 `SkillVersionDto`。
- 凭证恢复增加 `saveAssociation`，不重新安装目录。
- 备份管理增加 `listBackups` 和 `restoreBackup`。
- Claude 接入增加 `getClaudeLinkStatus` 和 `createClaudeLink`。
- 本地错误使用独立 `LocalSkillError`，不复用在线 `SkillApiError`。

### 7.2 SkillApi

现有 `SkillApi` 直接作为在线端口，不另建一套重复接口。它负责：

- 查询 Skill 与版本。
- 获取下载凭证。
- 查询已安装 Skill 的在线状态。
- 解析 `skillName + contentHash`。
- 上报安装成功事件。
- 执行平台发布和管理操作。

`MockSkillApi` 继续用于浏览器开发和测试，后端接入时增加 `HttpSkillApi`。OpenAPI 生成 DTO 和在线错误结构保持在该边界内。

### 7.3 InstallationService

`InstallationService` 是唯一需要新增的前端应用服务，用来承接 `App.tsx` 中已有的 `installSkillVersion`、冲突转换和安装上报流程。它组合现有 `SkillApi` 与 `LocalSkillService`：

```ts
interface InstallationService {
  installPlatformVersion(input: PlatformInstallRequest): Promise<PlatformInstallResult>;
  recoverPlatformAssociation(localSkillId: string): Promise<LocalSkillRecord>;
  replaceRelatedSkill(input: RelatedSkillReplacementRequest): Promise<PlatformInstallResult>;
}
```

`App.tsx` 保留登录拦截、弹窗状态和 Toast；下载凭证、DTO 转换、本地安装、凭证写入和安装上报由 `InstallationService` 完成。`InstallConfirmModal` 与 `InstallFeedbackModal` 保持现有展示职责。

## 8. 关键流程

### 8.1 启动与本地列表

1. 本地服务扫描 Skill 目录和安装凭证。
2. 计算当前内容哈希并生成本地状态。
3. 页面立即展示本地结果，不等待在线请求。
4. 对有关联标识的记录异步查询在线状态。
5. 在线结果只更新附加标签和说明。
6. 在线请求失败时保留本地结果，并提供重新检查入口。

### 8.2 安装在线版本

1. 在线服务确认目标 Skill 与版本可安装。
2. 获取短期下载凭证并下载到临时缓存。
3. 校验 `packageSha256`。
4. 本地适配器执行安全解析并校验 `contentHash`。
5. 发现同名内容时向页面返回确认请求。
6. 用户确认后创建备份并执行原子替换。
7. 最终扫描确认磁盘内容与目标哈希一致。
8. 原子写入安装凭证。
9. 使用唯一事件编号上报安装成功。

本地替换完成后即视为安装成功。安装事件上报失败不回滚本地目录，事件编号保留用于幂等重试。

### 8.3 恢复平台关联

1. 本地扫描发现没有安装凭证的 Skill。
2. 页面先按 `LOCAL_UNKNOWN` 展示。
3. 在线可用时提交 `skillName + contentHash` 查询匹配。
4. 匹配成功后写入本地凭证并标记为 `PLATFORM_MATCHED`。
5. 该流程不重新安装、不创建备份、不增加安装次数。

### 8.4 强制安装与失败恢复

1. 同名目录内容不同时停止写入并展示差异与风险。
2. 用户明确确认后备份原目录。
3. 新目录通过临时路径写入并完成最终校验。
4. 使用原子重命名切换生效目录。
5. 任一步骤失败时恢复原目录。
6. 每个 Skill 只保留最近 3 份成功备份。

### 8.5 本地移除与备份恢复

移除和恢复是纯本地操作，不调用在线 API。删除、移动或覆盖目录前必须明确展示目标路径、影响和恢复方式。

移除平台安装的 Skill 只删除当前设备的目录和对应凭证，不归档在线 Skill，也不修改平台安装统计。

## 9. 离线与异常规则

| 场景 | 行为 |
| --- | --- |
| 未登录 | 可扫描、查看、备份、恢复和移除本地 Skill |
| 断网 | 保留全部本地结果，在线状态显示不可用 |
| 在线 Skill 已归档 | 本地内容继续可用，不自动删除 |
| 在线名称失效 | 本地内容继续可用，禁止从平台重新安装或更新 |
| 已安装版本撤回 | 显示原因和推荐版本，由用户确认是否切换 |
| 凭证损坏 | 保留磁盘内容，标记关联不可确认 |
| 目录缺失 | 保留凭证并标记 `MISSING`，由用户决定清理凭证或重新安装 |
| 安装事件上报失败 | 保留本地安装结果，使用同一事件编号重试 |

任何在线异常都不能触发本地目录的自动删除、降级、覆盖或恢复。

## 10. 安全与原子性

- 拒绝绝对路径、路径穿越、符号链接、目录联接和大小写冲突。
- 限制包大小、解压大小、文件数量和单文件大小。
- 安装过程不执行包中的脚本或二进制文件。
- 下载包先校验 `packageSha256`，解压结果再校验 `contentHash`。
- 凭证、备份索引和生效目录使用临时文件或临时目录配合原子重命名。
- 删除、替换和恢复必须限定到解析后的明确 Skill 目录，不能接受任意绝对路径。
- Rust 层记录扫描、校验、备份、替换、恢复和异常降级日志。

## 11. 跨平台边界

React 和应用服务只依赖统一端口，不包含 Windows、macOS 或 Linux 路径与链接逻辑。

Rust 适配器负责：

- 解析用户主目录和规范化目标路径。
- Windows 目录联接、权限和文件占用处理。
- macOS/Linux 符号链接、权限和原子重命名处理。
- Claude 目录链接的检测与创建。

各平台必须通过同一组临时目录集成测试，验证扫描、安装、冲突、备份、恢复和链接行为。

## 12. 代码落点

现有 `src/api` 作为服务边界目录继续使用，只增加必要文件：

```text
src/
├─ App.tsx
├─ components/
│  ├─ MySkillsPage.tsx
│  ├─ InstallConfirmModal.tsx
│  └─ InstallFeedbackModal.tsx
└─ api/
   ├─ contracts.ts
   ├─ index.ts
   ├─ installationService.ts
   ├─ mockSkillApi.ts
   ├─ mockLocalSkillService.ts
   ├─ tauriLocalSkillService.ts
   └─ httpSkillApi.ts

src-tauri/src/
├─ lib.rs
├─ local_skills/
│  ├─ scan.rs
│  ├─ hash.rs
│  ├─ install.rs
│  ├─ backup.rs
│  └─ credentials.rs
└─ platform/
   ├─ windows.rs
   └─ macos.rs
```

`contracts.ts` 保持现有统一导出，内部模型数量增加后再拆为在线和本地文件，避免为了目录形式一次性移动现有代码。`index.ts` 负责创建 `skillApi`、`localSkillService` 和 `installationService`。

## 13. 实施阶段

### 阶段一：收敛现有前端边界

- 从 `App.tsx` 提取 `InstallationService`，保留现有弹窗和页面回调。
- 调整 `LocalInstallRequest`，移除对完整在线 DTO 的依赖。
- 为本地操作增加 `LocalSkillError`。
- `MySkillsPage` 扫描完成后立即展示本地结果，再异步补充在线状态。
- `installedSkillIds` 统一从本地扫描结果派生。

### 阶段二：只读 Tauri 本地能力

- 实现 `TauriLocalSkillService` 和只读 Tauri 命令协议。
- 实现目录扫描、`SKILL.md` 读取、内容哈希和凭证读取。
- 本地列表在断网和未登录状态下完整可用。
- 使用临时目录测试扫描、无效 Skill、缺失目录和本地修改。

### 阶段三：安全本地写入

- 实现备份、原子安装、强制替换、失败恢复和本地移除。
- 实现凭证的原子写入与清理。
- 把 `MockLocalSkillService` 中的冲突、回滚和 Claude 提示场景复用为适配器契约测试。
- 增加临时目录集成测试和故障注入测试。

### 阶段四：真实在线安装协调

- 接入下载凭证和真实包下载。
- 实现平台关联恢复、安装成功上报和幂等重试。
- 实现更新、降级、撤回版本切换和派生 Skill 一键替换。

### 阶段五：平台适配与管理

- 完成 Windows 与 macOS 适配器。
- 实现 Claude 链接引导。
- 增加备份列表和手动恢复页面。

## 14. 文档职责

- 本文档定义本地、在线和协调领域的架构边界。
- [`PRODUCT_DESIGN.md`](./PRODUCT_DESIGN.md) 定义产品行为和业务规则。
- [`API_REFERENCE.md`](./API_REFERENCE.md) 与 [`openapi.yaml`](./openapi.yaml) 定义在线 HTTP 契约。
- [`adr/0003-local-installation-state.md`](./adr/0003-local-installation-state.md) 记录本地状态与跨平台边界的架构决策。
