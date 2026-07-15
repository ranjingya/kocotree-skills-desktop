import { describe, expect, it } from "vitest";
import { SkillApiError } from "./contracts";
import { MockSkillApi } from "./mockSkillApi";

function expectApiError(reason: unknown, code: SkillApiError["code"]): void {
  expect(reason).toBeInstanceOf(SkillApiError);
  expect((reason as SkillApiError).code).toBe(code);
}

describe("MockSkillApi", () => {
  it("允许匿名浏览并按 Tag 筛选", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    const tags = await api.listTags();
    const result = await api.listSkills({ tagId: tags[0].id });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((skill) => skill.tags.some((tag) => tag.id === tags[0].id))).toBe(true);
  });

  it("在上传前要求用户登录", async () => {
    const api = new MockSkillApi({ delayMs: 0 });

    await expect(api.inspectUpload(new File(["zip"], "anonymous.zip"))).rejects.toSatisfy(
      (reason: unknown) => {
        expectApiError(reason, "UNAUTHENTICATED");
        return true;
      },
    );
  });

  it("按解析结果创建新的 Skill", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const inspection = await api.inspectUpload(new File(["zip-content"], "my-workflow.zip"));
    const created = await api.createSkill({
      uploadId: inspection.uploadId,
      displayName: "我的工作流",
      displayDescription: "用于验证两步发布流程。",
      tags: { tagIds: [], newTagNames: ["测试"] },
      version: "1.0.0",
      changelog: "首次发布",
    });

    expect(created.skillName).toBe("my-workflow");
    expect(created.displayName).toBe("我的工作流");
    expect(created.tags.map((tag) => tag.name)).toContain("测试");
  });

  it("拒绝将名称不一致的包发布为已有 Skill 新版本", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const target = (await api.listSkills()).items[0];
    const inspection = await api.inspectUpload(new File(["zip-content"], "another-skill.zip"));

    await expect(api.publishSkillVersion(target.id, {
      uploadId: inspection.uploadId,
      version: "9.0.0",
      changelog: "名称不匹配测试",
    })).rejects.toSatisfy((reason: unknown) => {
      expectApiError(reason, "SKILL_NAME_MISMATCH");
      return true;
    });
  });

  it("按照 SemVer 规则比较预发布版本", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const target = (await api.listSkills()).items.find((skill) => skill.skillName === "code-review");
    expect(target).toBeDefined();
    const inspection = await api.inspectUpload(new File(["zip-content"], "code-review.zip"));

    await expect(api.publishSkillVersion(target!.id, {
      uploadId: inspection.uploadId,
      version: `${target!.latestVersion.version}-alpha.1`,
      changelog: "预发布版本比较测试",
    })).rejects.toSatisfy((reason: unknown) => {
      expectApiError(reason, "VERSION_NOT_GREATER");
      return true;
    });
  });

  it("限制非原上传者修改平台信息", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    const user = await api.signIn();
    const target = (await api.listSkills()).items.find((skill) => skill.uploadedBy.id !== user.id);
    expect(target).toBeDefined();

    await expect(api.updateSkillMetadata(target!.id, { displayName: "无权修改" })).rejects.toSatisfy(
      (reason: unknown) => {
        expectApiError(reason, "NOT_SKILL_OWNER");
        return true;
      },
    );
  });

  it("使用事件编号保证安装上报幂等", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const skill = (await api.listSkills()).items[0];
    const event = {
      eventId: crypto.randomUUID(),
      deviceId: "test-device",
      platform: "windows" as const,
      clientVersion: "0.1.0",
      installedAt: new Date().toISOString(),
    };

    const first = await api.recordInstallation(skill.id, skill.latestVersion.id, event);
    const repeated = await api.recordInstallation(skill.id, skill.latestVersion.id, event);

    expect(first.recorded).toBe(true);
    expect(repeated.recorded).toBe(false);
    expect(repeated.installCount).toBe(first.installCount);
  });
});
