import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { SkillApiError } from "./contracts";
import { MockSkillApi } from "./mockSkillApi";
import { parseSkillPackage } from "./skillPackage";

function expectApiError(reason: unknown, code: SkillApiError["code"]): void {
  expect(reason).toBeInstanceOf(SkillApiError);
  expect((reason as SkillApiError).code).toBe(code);
}

/**
 * 功能说明：生成包含合法 SKILL.md 和附加文件的测试 ZIP。
 * @param skillName - SKILL.md 中使用的 Skill 名称。
 * @param rootDirectory - 可选的单层外包装目录。
 * @returns 浏览器上传接口可直接使用的 ZIP 文件。
 */
async function createSkillZip(skillName: string, rootDirectory = ""): Promise<File> {
  const zip = new JSZip();
  const prefix = rootDirectory ? `${rootDirectory}/` : "";
  zip.file(
    `${prefix}SKILL.md`,
    `---\nname: ${skillName}\ndescription: Test ${skillName} workflow.\n---\n`,
  );
  zip.file(`${prefix}references/usage.md`, `# ${skillName}\n`);
  zip.file(`${prefix}assets/icon.png`, new Uint8Array([137, 80, 78, 71]));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], `${skillName}.zip`, { type: "application/zip" });
}

describe("MockSkillApi", () => {
  it("允许匿名浏览并按 Tag 筛选", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    const tags = await api.listTags();
    const result = await api.listSkills({ tagId: tags[0].id });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((skill) => skill.tags.some((tag) => tag.id === tags[0].id))).toBe(true);
  });

  it("允许本地解析，但在发布前要求用户登录", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    const file = await createSkillZip("anonymous");
    const parsed = await parseSkillPackage(file);

    expect(parsed.inspection.skillName).toBe("anonymous");
    await expect(api.createSkill({
      file,
      displayName: "匿名测试",
      displayDescription: "验证本地解析不依赖登录。",
      tags: { tagIds: [], newTagNames: [] },
      version: "1.0.0",
    })).rejects.toSatisfy(
      (reason: unknown) => {
        expectApiError(reason, "UNAUTHENTICATED");
        return true;
      },
    );
  });

  it("通过单次发布请求创建新的 Skill", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const created = await api.createSkill({
      file: await createSkillZip("my-workflow", "my-workflow"),
      displayName: "我的工作流",
      displayDescription: "用于验证单次发布流程。",
      tags: { tagIds: [], newTagNames: ["测试"] },
      version: "1.0.0",
      changelog: "首次发布",
    });

    expect(created.skillName).toBe("my-workflow");
    expect(created.displayName).toBe("我的工作流");
    expect(created.tags.map((tag) => tag.name)).toContain("测试");

    const files = await api.listVersionFiles(created.id, created.latestVersion.id);
    expect(files.items.map((item) => item.path)).toContain("references/usage.md");
    const content = await api.getVersionFileContent(
      created.id,
      created.latestVersion.id,
      "references/usage.md",
    );
    expect(content.content).toContain("my-workflow");
  });

  it("拒绝将名称不一致的包发布为已有 Skill 新版本", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const target = (await api.listSkills()).items[0];

    await expect(api.publishSkillVersion(target.id, {
      file: await createSkillZip("another-skill"),
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

    await expect(api.publishSkillVersion(target!.id, {
      file: await createSkillZip("code-review"),
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

  it("拒绝缺少 SKILL.md 的 ZIP", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    await api.signIn();
    const zip = new JSZip();
    zip.file("README.md", "missing skill metadata");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    await expect(api.createSkill({
      file: new File([buffer], "invalid.zip"),
      displayName: "无效 Skill",
      displayDescription: "用于验证服务端重新校验 ZIP。",
      tags: { tagIds: [], newTagNames: [] },
      version: "1.0.0",
    })).rejects.toSatisfy(
      (reason: unknown) => {
        expectApiError(reason, "INVALID_SKILL_PACKAGE");
        return true;
      },
    );
  });

  it("拒绝预览二进制文件", async () => {
    const api = new MockSkillApi({ delayMs: 0 });
    const skill = (await api.listSkills()).items[0];

    await expect(
      api.getVersionFileContent(skill.id, skill.latestVersion.id, "assets/icon.png"),
    ).rejects.toSatisfy((reason: unknown) => {
      expectApiError(reason, "FILE_PREVIEW_UNAVAILABLE");
      return true;
    });
  });
});
