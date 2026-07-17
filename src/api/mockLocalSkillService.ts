import { SkillApiError, type LocalInstallRequest, type LocalInstallResult, type LocalSkillRecord, type LocalSkillService } from "./contracts";

const initialRecords: LocalSkillRecord[] = [
  {
    id: "local-code-review",
    skillId: "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1001",
    versionId: "8b37c0a5-f1c9-4f4e-a71b-b6f06f671001",
    version: "1.4.2",
    skillName: "code-review",
    displayName: "代码审查助手",
    installPath: "~/.agents/skills/code-review",
    contentHash: `sha256:${"b".repeat(64)}-1001`,
    installedAt: "2026-07-16T08:00:00.000Z",
    status: "PLATFORM_INSTALLED",
  },
  {
    id: "local-personal-helper",
    skillId: null,
    versionId: null,
    version: null,
    skillName: "personal-helper",
    displayName: "个人工作助手",
    installPath: "~/.agents/skills/personal-helper",
    contentHash: `sha256:${"c".repeat(64)}`,
    installedAt: null,
    status: "LOCAL_UNKNOWN",
  },
];

/** 浏览器开发阶段使用的本地 Skill 内存模拟服务。 */
export class MockLocalSkillService implements LocalSkillService {
  private readonly records = structuredClone(initialRecords);
  private readonly delayMs: number;

  constructor(delayMs = 160) {
    this.delayMs = delayMs;
  }

  private async wait(): Promise<void> {
    await new Promise((resolve) => globalThis.setTimeout(resolve, this.delayMs));
  }

  async scanSkills(): Promise<LocalSkillRecord[]> {
    await this.wait();
    return structuredClone(this.records);
  }

  /**
   * 功能说明：模拟安装、覆盖和备份结果，不读写真实文件系统。
   * @param input - 待安装的 Skill、版本和强制替换标记。
   * @returns 新的本地记录以及模拟备份信息。
   */
  async install(input: LocalInstallRequest): Promise<LocalInstallResult> {
    await this.wait();
    const conflict = this.records.find((item) => item.skillName === input.version.skillName);
    if (conflict && !input.force && (conflict.skillId !== input.skill.id || conflict.status !== "PLATFORM_INSTALLED")) {
      throw new SkillApiError("LOCAL_SKILL_CONFLICT", "本地已存在同名 Skill，请确认后强制替换", { localSkill: structuredClone(conflict) });
    }
    const record: LocalSkillRecord = {
      id: conflict?.id ?? crypto.randomUUID(),
      skillId: input.skill.id,
      versionId: input.version.id,
      version: input.version.version,
      skillName: input.version.skillName,
      displayName: input.skill.displayName,
      installPath: `~/.agents/skills/${input.version.skillName}`,
      contentHash: input.version.contentHash,
      installedAt: new Date().toISOString(),
      status: "PLATFORM_INSTALLED",
    };
    if (conflict) Object.assign(conflict, record);
    else this.records.push(record);
    console.info("[MockLocalSkillService] 模拟安装完成", { skillName: record.skillName, force: Boolean(input.force) });
    return {
      record: structuredClone(record),
      replacedSkillName: conflict && input.force ? conflict.skillName : null,
      backupPath: conflict && input.force ? `~/.agents/.kocotree/backups/${conflict.skillName}-${Date.now()}` : null,
    };
  }

  async remove(skillName: string): Promise<void> {
    await this.wait();
    const index = this.records.findIndex((item) => item.skillName === skillName);
    if (index >= 0) this.records.splice(index, 1);
  }
}
