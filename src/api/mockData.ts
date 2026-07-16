import type {
  SkillDetailDto,
  SkillFileEntryDto,
  SkillVersionDto,
  TagDto,
  UserDto,
} from "./contracts";

export interface MockVersionFileSource {
  files: SkillFileEntryDto[];
  contents: Record<string, string>;
}

export const mockUsers = {
  current: {
    id: "4e6ee36b-e6ed-4400-b304-89f22c0527d1",
    name: "鸭腿",
    email: "yatui@example.com",
    avatarUrl: null,
    departmentPath: ["运营中心", "运营办"],
    status: "ACTIVE",
  },
  lin: {
    id: "4e6ee36b-e6ed-4400-b304-89f22c0527d2",
    name: "林晓",
    email: "linxiao@example.com",
    avatarUrl: null,
    departmentPath: [],
    status: "ACTIVE",
  },
  chen: {
    id: "4e6ee36b-e6ed-4400-b304-89f22c0527d3",
    name: "陈默",
    email: "chenmo@example.com",
    avatarUrl: null,
    departmentPath: [],
    status: "ACTIVE",
  },
} satisfies Record<string, UserDto>;

export const mockTags: TagDto[] = [
  { id: "2bb6b0f2-96f9-49e1-8c2c-a92503171001", name: "代码审查" },
  { id: "2bb6b0f2-96f9-49e1-8c2c-a92503171002", name: "内容处理" },
  { id: "2bb6b0f2-96f9-49e1-8c2c-a92503171003", name: "数据分析" },
  { id: "2bb6b0f2-96f9-49e1-8c2c-a92503171004", name: "开发工具" },
  { id: "2bb6b0f2-96f9-49e1-8c2c-a92503171005", name: "项目协作" },
  { id: "2bb6b0f2-96f9-49e1-8c2c-a92503171006", name: "安全" },
];

const packageHash = `sha256:${"a".repeat(64)}`;
const contentHash = `sha256:${"b".repeat(64)}`;

/**
 * 功能说明：创建模拟版本记录，保证所有演示数据符合接口契约。
 * @param id - 版本 UUID。
 * @param version - SemVer 版本号。
 * @param skillName - SKILL.md 中的唯一名称。
 * @param skillDescription - SKILL.md 中的原始简介。
 * @param publishedAt - 版本发布时间。
 * @param uploadedBy - 实际发布该版本的用户。
 * @param changelog - 版本更新说明。
 * @returns 完整的模拟 SkillVersion。
 */
function createVersion(
  id: string,
  version: string,
  skillName: string,
  skillDescription: string,
  publishedAt: string,
  uploadedBy: UserDto,
  changelog: string | null,
): SkillVersionDto {
  return {
    id,
    version,
    skillName,
    skillDescription,
    changelog,
    packageSize: 12_042,
    packageSha256: packageHash,
    contentHash,
    skillMd: `---\nname: ${skillName}\ndescription: ${skillDescription}\n---\n`,
    publishedAt,
    uploadedBy,
  };
}

const versionFixtures: Record<string, SkillVersionDto[]> = {
  "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1001": [
    createVersion("8b37c0a5-f1c9-4f4e-a71b-b6f06f671001", "1.4.2", "code-review", "Review code changes against project rules.", "2026-07-15T01:40:00.000Z", mockUsers.current, "补充 TypeScript 与 Rust 审查规则"),
    createVersion("8b37c0a5-f1c9-4f4e-a71b-b6f06f671011", "1.3.0", "code-review", "Review code changes against project rules.", "2026-07-01T08:20:00.000Z", mockUsers.lin, "优化审查结果结构"),
  ],
  "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1002": [createVersion("8b37c0a5-f1c9-4f4e-a71b-b6f06f671002", "2.1.0", "meeting-notes", "Turn meeting records into decisions and action items.", "2026-07-14T08:25:00.000Z", mockUsers.lin, "增加风险清单")],
  "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1003": [createVersion("8b37c0a5-f1c9-4f4e-a71b-b6f06f671003", "1.2.3", "data-insight", "Analyze tabular data and explain metric changes.", "2026-07-12T03:08:00.000Z", mockUsers.chen, "完善异常原因摘要")],
  "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1004": [createVersion("8b37c0a5-f1c9-4f4e-a71b-b6f06f671004", "1.0.6", "api-doc-writer", "Generate consistent API documentation from source code.", "2026-07-10T06:30:00.000Z", mockUsers.current, "支持更多 TypeScript 类型")],
  "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1005": [createVersion("8b37c0a5-f1c9-4f4e-a71b-b6f06f671005", "1.3.1", "weekly-report", "Summarize project progress into a weekly report.", "2026-07-08T10:12:00.000Z", mockUsers.lin, "优化风险事项格式")],
  "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1006": [createVersion("8b37c0a5-f1c9-4f4e-a71b-b6f06f671006", "0.9.5", "sql-checker", "Identify risky and expensive SQL operations.", "2026-07-06T02:05:00.000Z", mockUsers.chen, "补充高危写入检查")],
};

const skillMeta = [
  ["1001", "code-review", "代码审查助手", "按照团队规范检查变更，输出可执行的审查意见。", [0, 3, 5], mockUsers.current, 128, "2026-06-01T01:30:00.000Z"],
  ["1002", "meeting-notes", "会议纪要整理", "将会议记录整理为结论、待办和风险清单。", [1, 4], mockUsers.lin, 96, "2026-05-20T06:10:00.000Z"],
  ["1003", "data-insight", "经营数据洞察", "分析表格数据，生成指标变化与异常原因摘要。", [2], mockUsers.chen, 74, "2026-06-18T02:20:00.000Z"],
  ["1004", "api-doc-writer", "接口文档生成", "根据接口代码生成统一格式的使用说明和请求示例。", [3], mockUsers.current, 61, "2026-06-28T07:00:00.000Z"],
  ["1005", "weekly-report", "研发周报汇总", "合并项目进展，生成面向团队的结构化周报。", [1, 4], mockUsers.lin, 53, "2026-06-12T09:18:00.000Z"],
  ["1006", "sql-checker", "SQL 安全检查", "识别 SQL 中的性能风险和高危数据操作。", [2, 5], mockUsers.chen, 47, "2026-07-02T04:45:00.000Z"],
] as const;

export const mockSkillDetails: SkillDetailDto[] = skillMeta.map((item) => {
  const [idSuffix, skillName, displayName, displayDescription, tagIndexes, owner, installCount, createdAt] = item;
  const id = `0c9c2f8d-3e84-4c0c-8a15-d41d87fd${idSuffix}`;
  const latestVersion = versionFixtures[id][0];
  return {
    id,
    skillName,
    displayName,
    skillDescription: latestVersion.skillDescription,
    displayDescription,
    tags: tagIndexes.map((index) => mockTags[index]),
    latestVersion,
    uploadedBy: owner,
    updatedBy: latestVersion.uploadedBy,
    installCount,
    createdAt,
    updatedAt: latestVersion.publishedAt,
  };
});

export const mockVersions = versionFixtures;

/**
 * 功能说明：为演示版本创建稳定的文件清单与文本内容。
 * @param version - 需要生成文件数据的 Skill 版本。
 * @returns 可供模拟文件树和文本预览接口读取的数据。
 */
function createVersionFileSource(version: SkillVersionDto): MockVersionFileSource {
  const usage = `# ${version.skillName}\n\n${version.skillDescription}\n`;
  return {
    files: [
      { path: "assets", type: "DIRECTORY", size: null, mediaType: null, previewable: false },
      { path: "references", type: "DIRECTORY", size: null, mediaType: null, previewable: false },
      { path: "SKILL.md", type: "FILE", size: new Blob([version.skillMd]).size, mediaType: "text/markdown", previewable: true },
      { path: "assets/icon.png", type: "FILE", size: 2_048, mediaType: null, previewable: false },
      { path: "references/usage.md", type: "FILE", size: new Blob([usage]).size, mediaType: "text/markdown", previewable: true },
    ],
    contents: {
      "SKILL.md": version.skillMd,
      "references/usage.md": usage,
    },
  };
}

export const mockVersionFiles = Object.fromEntries(
  Object.values(versionFixtures)
    .flat()
    .map((version) => [version.id, createVersionFileSource(version)]),
) satisfies Record<string, MockVersionFileSource>;
