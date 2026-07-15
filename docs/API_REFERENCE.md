# Kocotree Skills API 参考

## 1. 文档状态

本文档定义 Kocotree Skills 客户端依赖的首版 HTTP 契约。当前项目只实现模拟接口；真实后端、真实飞书认证和对象存储不在本阶段范围内。

机器可读契约见 [`openapi.yaml`](./openapi.yaml)。两者不一致时，以 OpenAPI 为准。旧版后端文档仅作为设备授权、Bearer Token、分页和基础字段的参考，不代表本契约已经实现。

## 2. 公共约定

| 项目 | 约定 |
| --- | --- |
| 基础路径 | `/api` |
| JSON 字段 | 英文 `camelCase` |
| 时间 | ISO 8601 UTC，例如 `2026-07-15T09:30:00.000Z` |
| 标识符 | 平台实体使用 UUID |
| 版本号 | SemVer，例如 `1.2.0` |
| 哈希 | `sha256:` 加 64 位小写十六进制 |
| 鉴权 | `Authorization: Bearer <token>` |
| 分页 | 页码从 1 开始，默认每页 20 条，最大 50 条 |

成功响应直接返回业务对象。错误响应统一为：

```json
{
  "error": "INVALID_SKILL_PACKAGE",
  "message": "ZIP 中没有找到 SKILL.md",
  "details": {
    "field": "file"
  },
  "requestId": "req_01J..."
}
```

`details` 和 `requestId` 可以缺省。客户端根据 `error` 决定交互，根据 `message` 向用户解释原因，不应解析英文或中文消息文本来判断分支。

## 3. 鉴权矩阵

| 接口 | 匿名可用 |
| --- | --- |
| 获取 Skill 列表、详情、版本历史 | 是 |
| 获取 Tag 列表 | 是 |
| 发起或轮询设备授权 | 是 |
| 获取当前用户 | 否 |
| 解析 ZIP、创建 Skill、发布版本 | 否 |
| 修改 Skill 平台信息和 Tag | 否，仅原上传者可操作 |
| 获取下载地址、上报安装成功 | 否 |

匿名用户触发受保护动作时，客户端先完成设备授权，再重放原动作。

## 4. 核心字段

### 4.1 User

| 字段 | 类型 | 必返 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 平台用户 UUID。 |
| `name` | `string` | 是 | 飞书展示名。 |
| `email` | `string \| null` | 是 | 飞书未返回时为 `null`。 |
| `avatarUrl` | `string \| null` | 是 | 用户头像地址。 |
| `status` | `ACTIVE \| DISABLED` | 是 | 用户状态。 |

### 4.2 Tag

| 字段 | 类型 | 必返 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | Tag UUID。 |
| `name` | `string` | 是 | Tag 展示名。 |

### 4.3 SkillSummary

| 字段 | 类型 | 必返 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | Skill UUID。 |
| `skillName` | `string` | 是 | `SKILL.md` 中的名称，全局唯一且不可修改。 |
| `displayName` | `string` | 是 | 平台展示名称。 |
| `skillDescription` | `string` | 是 | 最新版本 `SKILL.md` 中的描述。 |
| `displayDescription` | `string` | 是 | 平台展示简介。 |
| `tags` | `Tag[]` | 是 | 最多 5 个。 |
| `latestVersion` | `SkillVersionSummary` | 是 | 最新版本摘要。 |
| `uploadedBy` | `User` | 是 | 首次上传并创建 Skill 的用户。 |
| `updatedBy` | `User` | 是 | 最近修改平台信息或发布新版本的用户。 |
| `installCount` | `number` | 是 | 成功安装操作总数。 |
| `createdAt` | `string` | 是 | 创建时间。 |
| `updatedAt` | `string` | 是 | 最近修改平台信息或发布新版本的时间。 |

### 4.4 SkillVersion

| 字段 | 类型 | 必返 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 版本 UUID。 |
| `version` | `string` | 是 | SemVer。 |
| `skillName` | `string` | 是 | 该版本 `SKILL.md` 中的名称。 |
| `skillDescription` | `string` | 是 | 该版本 `SKILL.md` 中的描述。 |
| `changelog` | `string \| null` | 是 | 首版可以为空，更新版本必填。 |
| `packageSize` | `number` | 是 | ZIP 字节数。 |
| `packageSha256` | `string` | 是 | 原始 ZIP 哈希。 |
| `contentHash` | `string` | 是 | 规范化目录内容哈希。 |
| `skillMd` | `string` | 是 | 该版本原始 `SKILL.md` 快照。 |
| `publishedAt` | `string` | 是 | 发布时间。 |
| `uploadedBy` | `User` | 是 | 版本上传者。 |

### 4.5 服务端与本地状态边界

以下字段不能加入服务端 Skill 响应：

- `installed`
- `installedVersionId`
- `localModified`
- `installPath`
- `backupCount`
- `claudeLinkStatus`

这些值由 Tauri 客户端扫描本地目录后与服务端数据合并。

## 5. 设备授权

### 5.1 发起授权

```http
POST /api/auth/device/start
Content-Type: application/json
```

请求：

```json
{
  "clientName": "Kocotree Skills 0.1.0",
  "deviceName": "KK-PC",
  "platform": "windows"
}
```

响应 `201`：

```json
{
  "deviceCode": "koco_device_xxx",
  "userCode": "6T5V-T6FK",
  "verificationUrl": "https://skills.example.com/auth/device?...",
  "expiresAt": "2026-07-15T09:40:00.000Z",
  "pollInterval": 3
}
```

### 5.2 轮询授权

```http
GET /api/auth/device/poll?deviceCode=koco_device_xxx
```

等待中响应 `200`：

```json
{
  "status": "PENDING",
  "pollInterval": 3
}
```

授权成功响应 `200`：

```json
{
  "status": "AUTHORIZED",
  "user": {
    "id": "4e6ee36b-e6ed-4400-b304-89f22c0527d1",
    "name": "示例用户",
    "email": null,
    "avatarUrl": null,
    "status": "ACTIVE"
  },
  "token": "koco_xxx",
  "expiresAt": "2027-01-05T02:54:42.826Z"
}
```

其他状态为 `EXPIRED`、`DENIED` 或 `EXCHANGED`。令牌只在首次成功领取时返回，不得写入普通日志。

### 5.3 当前用户

```http
GET /api/me
Authorization: Bearer <token>
```

响应 `200`：

```json
{
  "user": {
    "id": "4e6ee36b-e6ed-4400-b304-89f22c0527d1",
    "name": "示例用户",
    "email": null,
    "avatarUrl": null,
    "status": "ACTIVE"
  },
  "scopes": ["skill:publish", "skill:install"]
}
```

## 6. Tag

### 6.1 获取 Tag 列表

```http
GET /api/tags?q=代码
```

匿名可用。响应 `200`：

```json
{
  "items": [
    {
      "id": "2bb6b0f2-96f9-49e1-8c2c-a92503171001",
      "name": "代码审查"
    }
  ]
}
```

创建 Skill 或修改平台信息时可以同时提交已有 Tag 编号和新 Tag 名称。服务端负责规范化、去重和创建，不提供单独的新建或重命名 Tag 接口。

## 7. Skill 查询

### 7.1 获取 Skill 列表

```http
GET /api/skills?q=审查&tagId=2bb6b0f2-96f9-49e1-8c2c-a92503171001&sort=updated&page=1&pageSize=20
```

查询参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `q` | `string` | 无 | 搜索 Skill 名称、展示名称、Skill 描述、展示简介和 Tag。 |
| `tagId` | `string` | 无 | 单个 Tag UUID。 |
| `sort` | `created \| updated \| popular` | `updated` | 创建时间、最新版本发布时间或安装次数倒序。 |
| `page` | `number` | `1` | 页码。 |
| `pageSize` | `number` | `20` | 每页数量，最大 50。 |

响应 `200`：

```json
{
  "items": [
    {
      "id": "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1001",
      "skillName": "code-review",
      "displayName": "代码审查助手",
      "skillDescription": "Review code changes against project rules.",
      "displayDescription": "按照团队规范检查代码变更。",
      "tags": [
        {
          "id": "2bb6b0f2-96f9-49e1-8c2c-a92503171001",
          "name": "代码审查"
        }
      ],
      "latestVersion": {
        "id": "8b37c0a5-f1c9-4f4e-a71b-b6f06f671001",
        "version": "1.4.2",
        "skillName": "code-review",
        "skillDescription": "Review code changes against project rules.",
        "packageSize": 12042,
        "publishedAt": "2026-07-15T09:30:00.000Z",
        "uploadedBy": {
          "id": "4e6ee36b-e6ed-4400-b304-89f22c0527d1",
          "name": "示例用户",
          "email": null,
          "avatarUrl": null,
          "status": "ACTIVE"
        }
      },
      "uploadedBy": {
        "id": "4e6ee36b-e6ed-4400-b304-89f22c0527d1",
        "name": "示例用户",
        "email": null,
        "avatarUrl": null,
        "status": "ACTIVE"
      },
      "updatedBy": {
        "id": "4e6ee36b-e6ed-4400-b304-89f22c0527d1",
        "name": "示例用户",
        "email": null,
        "avatarUrl": null,
        "status": "ACTIVE"
      },
      "installCount": 128,
      "createdAt": "2026-06-01T09:30:00.000Z",
      "updatedAt": "2026-07-15T09:30:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

### 7.2 获取 Skill 详情

```http
GET /api/skills/{skillId}
```

响应 `200` 包含完整 `SkillSummary`，并将 `latestVersion` 展开为完整版本信息：

```json
{
  "latestVersion": {
    "id": "8b37c0a5-f1c9-4f4e-a71b-b6f06f671001",
    "version": "1.4.2",
    "skillName": "code-review",
    "skillDescription": "Review code changes against project rules.",
    "changelog": "补充 TypeScript 检查规则",
    "packageSize": 12042,
    "packageSha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "contentHash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "skillMd": "---\nname: code-review\ndescription: Review code changes.\n---\n",
    "publishedAt": "2026-07-15T09:30:00.000Z",
    "uploadedBy": {
      "id": "4e6ee36b-e6ed-4400-b304-89f22c0527d1",
      "name": "示例用户",
      "email": null,
      "avatarUrl": null,
      "status": "ACTIVE"
    }
  }
}
```

完整响应仍包含列表项中的其他字段。找不到 Skill 返回 `404 SKILL_NOT_FOUND`。

### 7.3 获取版本历史

```http
GET /api/skills/{skillId}/versions?page=1&pageSize=20
```

响应 `200`：

```json
{
  "items": [
    {
      "id": "8b37c0a5-f1c9-4f4e-a71b-b6f06f671001",
      "version": "1.4.2",
      "skillName": "code-review",
      "skillDescription": "Review code changes against project rules.",
      "changelog": "补充 TypeScript 检查规则",
      "packageSize": 12042,
      "packageSha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "contentHash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "skillMd": "---\nname: code-review\n---\n",
      "publishedAt": "2026-07-15T09:30:00.000Z",
      "uploadedBy": {
        "id": "4e6ee36b-e6ed-4400-b304-89f22c0527d1",
        "name": "示例用户",
        "email": null,
        "avatarUrl": null,
        "status": "ACTIVE"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

版本按 SemVer 从高到低返回。

## 8. 上传、发布与平台信息

### 8.1 解析 ZIP

```http
POST /api/uploads/inspect
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

FormData 只包含一个 `file` 字段。不要手动拼接 `Content-Type` 的 boundary。

响应 `201`：

```json
{
  "uploadId": "76ce8065-7ed1-4f18-9deb-50de699b5afe",
  "expiresAt": "2026-07-15T10:00:00.000Z",
  "originalFileName": "code-review.zip",
  "skillName": "code-review",
  "skillDescription": "Review code changes against project rules.",
  "skillMd": "---\nname: code-review\ndescription: Review code changes.\n---\n",
  "packageSize": 12042,
  "fileCount": 8,
  "packageSha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "contentHash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "warnings": []
}
```

`uploadId` 默认 30 分钟后过期，只能成功发布一次。

### 8.2 创建 Skill

```http
POST /api/skills
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "uploadId": "76ce8065-7ed1-4f18-9deb-50de699b5afe",
  "displayName": "代码审查助手",
  "displayDescription": "按照团队规范检查代码变更。",
  "tags": {
    "tagIds": ["2bb6b0f2-96f9-49e1-8c2c-a92503171001"],
    "newTagNames": ["TypeScript"]
  },
  "version": "1.0.0",
  "changelog": "首次发布"
}
```

响应 `201` 为完整 `SkillDetail`。若 Skill 名称已存在，返回 `409 DUPLICATE_SKILL_NAME`，并在 `details.skillId` 中提供现有 Skill 编号。

### 8.3 修改平台信息

```http
PATCH /api/skills/{skillId}
Authorization: Bearer <token>
Content-Type: application/json
```

请求中的字段均可选，但至少提交一个字段：

```json
{
  "displayName": "代码审查助手",
  "displayDescription": "检查代码和配置变更。",
  "tags": {
    "tagIds": ["2bb6b0f2-96f9-49e1-8c2c-a92503171001"],
    "newTagNames": ["Rust"]
  }
}
```

只有 Skill 的 `uploadedBy` 可以调用。`tags` 出现时表示完整替换 Skill 的 Tag 关联，`tagIds` 与 `newTagNames` 合并去重后最多 5 个。修改成功返回完整 `SkillDetail`，更新 `updatedBy` 和 `updatedAt`，但不创建 SkillVersion。其他登录用户返回 `403 NOT_SKILL_OWNER`。

### 8.4 发布新版本

```http
POST /api/skills/{skillId}/versions
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "uploadId": "76ce8065-7ed1-4f18-9deb-50de699b5afe",
  "version": "1.5.0",
  "changelog": "增加 Rust 项目审查规则"
}
```

任意已登录用户都可以发布新版本。请求不接受 `displayName`、`displayDescription` 或 `tags`，响应 `201` 为更新后的完整 `SkillDetail`；Skill 的 `updatedBy` 更新为该版本上传者。

校验失败：

| HTTP | 错误码 | 说明 |
| --- | --- | --- |
| 400 | `INVALID_SEMVER` | 版本号不是合法 SemVer。 |
| 409 | `VERSION_ALREADY_EXISTS` | 相同版本号已存在。 |
| 409 | `VERSION_NOT_GREATER` | 新版本没有高于当前最新版本。 |
| 409 | `SKILL_NAME_MISMATCH` | ZIP 中的 Skill 名称与目标 Skill 不一致。 |
| 410 | `UPLOAD_EXPIRED` | 临时上传已过期。 |

`SKILL_NAME_MISMATCH` 的 `details` 返回 `expectedSkillName` 和 `actualSkillName`，客户端据此建议发布为新 Skill。

## 9. 下载与安装上报

### 9.1 获取指定版本下载凭证

```http
GET /api/skills/{skillId}/versions/{versionId}/download
Authorization: Bearer <token>
```

响应 `200`：

```json
{
  "url": "https://storage.example.com/signed-url",
  "expiresAt": "2026-07-15T09:35:00.000Z",
  "packageSize": 12042,
  "packageSha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "contentHash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}
```

生成下载凭证不增加安装次数。

### 9.2 上报成功安装

```http
POST /api/skills/{skillId}/versions/{versionId}/install-events
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "eventId": "91d73c57-0f5f-4986-8214-3bd040fa6152",
  "deviceId": "device_01J...",
  "platform": "windows",
  "clientVersion": "0.1.0",
  "installedAt": "2026-07-15T09:32:00.000Z"
}
```

响应 `200`：

```json
{
  "recorded": true,
  "installCount": 129
}
```

`eventId` 是幂等键。网络重试提交相同事件时返回 `recorded: false`，且安装次数不重复增加。

## 10. 常见错误码

| HTTP | 错误码 | 含义 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | 参数、分页或字段校验失败。 |
| 400 | `INVALID_SKILL_PACKAGE` | ZIP 结构或 `SKILL.md` 不合法。 |
| 400 | `PACKAGE_TOO_LARGE` | ZIP 或解压内容超出限制。 |
| 400 | `INVALID_SEMVER` | 版本号不是合法 SemVer。 |
| 401 | `UNAUTHENTICATED` | Token 缺失、无效或过期。 |
| 403 | `USER_DISABLED` | 当前用户被停用。 |
| 403 | `NOT_SKILL_OWNER` | 当前用户不是 Skill 原上传者，不能修改平台信息。 |
| 404 | `SKILL_NOT_FOUND` | Skill 不存在。 |
| 404 | `VERSION_NOT_FOUND` | 版本不存在或不属于该 Skill。 |
| 404 | `UPLOAD_NOT_FOUND` | 临时上传不存在。 |
| 409 | `DUPLICATE_SKILL_NAME` | Skill 名称已存在。 |
| 409 | `SKILL_NAME_MISMATCH` | 更新包中的 Skill 名称不匹配。 |
| 409 | `VERSION_ALREADY_EXISTS` | 版本号重复。 |
| 409 | `VERSION_NOT_GREATER` | 版本号没有严格递增。 |
| 409 | `UPLOAD_ALREADY_USED` | 临时上传已经完成发布。 |
| 410 | `UPLOAD_EXPIRED` | 临时上传已过期。 |
| 503 | `DOWNLOAD_UNAVAILABLE` | 暂时无法生成下载地址。 |

## 11. TypeScript DTO 示例

以下类型用于说明前端边界。实际开发时应从 `openapi.yaml` 生成服务端 DTO，避免手写类型与契约漂移。

```ts
export interface UserDto {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  status: "ACTIVE" | "DISABLED";
}

export interface TagDto {
  id: string;
  name: string;
}

export interface SkillVersionDto {
  id: string;
  version: string;
  skillName: string;
  skillDescription: string;
  changelog: string | null;
  packageSize: number;
  packageSha256: string;
  contentHash: string;
  skillMd: string;
  publishedAt: string;
  uploadedBy: UserDto;
}

export interface SkillSummaryDto {
  id: string;
  skillName: string;
  displayName: string;
  skillDescription: string;
  displayDescription: string;
  tags: TagDto[];
  latestVersion: Omit<
    SkillVersionDto,
    "changelog" | "packageSha256" | "contentHash" | "skillMd"
  >;
  uploadedBy: UserDto;
  updatedBy: UserDto;
  installCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillDetailDto extends Omit<SkillSummaryDto, "latestVersion"> {
  latestVersion: SkillVersionDto;
}

export interface TagAssignmentDto {
  tagIds: string[];
  newTagNames: string[];
}

export interface CreateSkillDto {
  uploadId: string;
  displayName: string;
  displayDescription: string;
  tags: TagAssignmentDto;
  version: string;
  changelog?: string;
}

export interface UpdateSkillMetadataDto {
  displayName?: string;
  displayDescription?: string;
  tags?: TagAssignmentDto;
}

export interface PublishSkillVersionDto {
  uploadId: string;
  version: string;
  changelog: string;
}

export interface UploadInspectionDto {
  uploadId: string;
  expiresAt: string;
  originalFileName: string;
  skillName: string;
  skillDescription: string;
  skillMd: string;
  packageSize: number;
  fileCount: number;
  packageSha256: string;
  contentHash: string;
  warnings: string[];
}

export interface DownloadTicketDto {
  url: string;
  expiresAt: string;
  packageSize: number;
  packageSha256: string;
  contentHash: string;
}

export interface InstallationEventDto {
  eventId: string;
  deviceId: string;
  platform: "windows" | "macos" | "linux";
  clientVersion: string;
  installedAt: string;
}

export interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorDto {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}
```

本地模型单独定义：

```ts
export type LocalSkillStatus =
  | "NOT_INSTALLED"
  | "INSTALLED"
  | "MODIFIED"
  | "UNKNOWN_SOURCE"
  | "MISSING";

export interface LocalInstallationState {
  skillId: string;
  versionId: string;
  version: string;
  skillName: string;
  installPath: string;
  contentHash: string;
  installedAt: string;
  serverUrl: string;
  status: LocalSkillStatus;
}
```

## 12. 模拟接口要求

当前前端阶段的 `MockSkillApi` 必须与未来 `HttpSkillApi` 实现同一个 TypeScript 接口，并覆盖：

- 正常列表、空列表、加载延迟和请求失败。
- 匿名浏览与受保护动作触发登录。
- ZIP 解析成功、包不合法和临时上传过期。
- 创建 Skill、Skill 名称冲突和上传新版本。
- 原上传者修改平台信息、非原上传者被拒绝和 Tag 完整替换。
- SemVer 递增校验与 Skill 名称不匹配。
- 指定版本下载凭证与幂等安装事件。

模拟阶段可以只保存元数据并返回虚拟下载地址，不执行真实文件上传或本地安装。
