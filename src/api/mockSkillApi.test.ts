import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { SkillApiError } from "./contracts";
import { MockSkillApi } from "./mockSkillApi";
import { mockUsers } from "./mockData";
import { parseSkillPackage } from "./skillPackage";

function expectApiError(reason: unknown, code: string): boolean {
  expect(reason).toBeInstanceOf(SkillApiError);
  expect((reason as SkillApiError).code).toBe(code);
  return true;
}

/**
 * 功能说明：生成包含合法 SKILL.md 和附加文件的测试 ZIP。
 * @param skillName - SKILL.md 中使用的 Skill 名称。
 * @param rootDirectory - 可选的单层外包装目录。
 * @param extraContent - 用于制造不同内容哈希的附加文本。
 * @returns 浏览器上传接口可直接使用的 ZIP 文件。
 */
async function createSkillZip(skillName: string, rootDirectory = "", extraContent = ""): Promise<File> {
  const zip = new JSZip();
  const prefix = rootDirectory ? `${rootDirectory}/` : "";
  zip.file(`${prefix}SKILL.md`, `---\nname: ${skillName}\ndescription: Test ${skillName} workflow.\n---\n${extraContent}`);
  zip.file(`${prefix}references/usage.md`, `# ${skillName}\n${extraContent}`);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], `${skillName}.zip`, { type: "application/zip" });
}

describe("MockSkillApi", () => {
  it("允许匿名浏览并隐藏归档 Skill", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    const result = await api.listSkills();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((skill) => skill.status !== "ARCHIVED")).toBe(true);
  });

  it("允许本地解析，但在发布前要求登录", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    const file = await createSkillZip("anonymous");
    expect((await parseSkillPackage(file)).inspection.skillName).toBe("anonymous");
    await expect(api.createSkill({ file, displayName: "匿名测试", displayDescription: "验证登录拦截。" }))
      .rejects.toSatisfy((reason: unknown) => expectApiError(reason, "UNAUTHENTICATED"));
  });

  it("新 Skill 首版本固定为 1.0.0", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const created = await api.createSkill({
      file: await createSkillZip("my-workflow", "my-workflow"),
      displayName: "我的工作流",
      displayDescription: "验证创建流程。",
      newTagNames: ["测试"],
    });
    expect(created.currentVersion.version).toBe("1.0.0");
    expect(created.owner.name).toBe("鸭腿");
    expect((await api.listVersionFiles(created.id, created.currentVersion.id)).some((item) => item.path === "SKILL.md")).toBe(true);
  });

  it("发布新版本要求 baseVersionId 与当前版本一致", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const target = (await api.listSkills()).items[0];
    await expect(api.publishSkillVersion(target.id, {
      file: await createSkillZip(target.skillName, "", "changed"),
      baseVersionId: "stale-version",
      version: "9.0.0",
      changelog: "并发冲突测试",
    })).rejects.toSatisfy((reason: unknown) => expectApiError(reason, "VERSION_CONFLICT"));
  });

  it("名称不一致时推荐发布为新的 Skill", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const target = (await api.listSkills()).items[0];
    await expect(api.publishSkillVersion(target.id, {
      file: await createSkillZip("another-skill"),
      baseVersionId: target.currentVersion.id,
      version: "9.0.0",
      changelog: "名称不匹配测试",
    })).rejects.toSatisfy((reason: unknown) => expectApiError(reason, "SKILL_NAME_MISMATCH"));
  });

  it("协作者不能修改展示名称", async () => {
    const api = new MockSkillApi({ delayMs: 0, initialUser: mockUsers.lin });
    const target = (await api.listSkills()).items.find((skill) => skill.skillName === "code-review");
    expect(target).toBeDefined();
    await expect(api.updateSkillMetadata(target!.id, { displayName: "无权修改" }))
      .rejects.toSatisfy((reason: unknown) => expectApiError(reason, "OWNER_REQUIRED"));
  });

  it("安装上报使用事件 ID 保持幂等", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const skill = (await api.listSkills()).items[0];
    const before = skill.installCount;
    const event = { eventId: crypto.randomUUID(), skillId: skill.id, versionId: skill.currentVersion.id, installedAt: new Date().toISOString() };
    await api.recordInstallation(event);
    await api.recordInstallation(event);
    expect((await api.getSkill(skill.id)).installCount).toBe(before + 1);
  });

  it("通知支持一键全部已读", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    expect((await api.listNotifications()).unreadCount).toBeGreaterThan(0);
    await api.readAllNotifications();
    expect((await api.listNotifications()).unreadCount).toBe(0);
  });
});
