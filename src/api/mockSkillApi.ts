import {
  SkillApiError,
  type CreateSkillDto,
  type DownloadTicketDto,
  type InstallationEventDto,
  type InstallationEventResponseDto,
  type ListSkillsQuery,
  type ListVersionsQuery,
  type PublishSkillVersionDto,
  type SkillApi,
  type SkillDetailDto,
  type SkillFileContentDto,
  type SkillFileListResponseDto,
  type SkillListResponseDto,
  type SkillVersionDto,
  type SkillVersionListResponseDto,
  type TagDto,
  type UpdateSkillMetadataDto,
  type UploadInspectionDto,
  type UserDto,
} from "./contracts";
import {
  mockSkillDetails,
  mockTags,
  mockUsers,
  mockVersionFiles,
  mockVersions,
  type MockVersionFileSource,
} from "./mockData";
import {
  inspectSkillZip,
  readArchiveText,
  type SkillArchiveSource,
} from "./zipInspector";

const MAX_PACKAGE_SIZE = 50 * 1024 * 1024;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export interface MockSkillApiOptions {
  delayMs?: number;
  initialUser?: UserDto | null;
}

interface StoredInspection {
  data: UploadInspectionDto;
  source: SkillArchiveSource;
  used: boolean;
}

type StoredVersionFileSource = SkillArchiveSource | MockVersionFileSource;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function compareSemVer(left: string, right: string): number {
  const [leftVersion, leftPrerelease] = left.split("+")[0].split("-");
  const [rightVersion, rightPrerelease] = right.split("+")[0].split("-");
  const leftParts = leftVersion.split(".").map(Number);
  const rightParts = rightVersion.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  if (!leftPrerelease && !rightPrerelease) return 0;
  if (!leftPrerelease) return 1;
  if (!rightPrerelease) return -1;
  const leftIdentifiers = leftPrerelease.split(".");
  const rightIdentifiers = rightPrerelease.split(".");
  const length = Math.max(leftIdentifiers.length, rightIdentifiers.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftIdentifiers[index];
    const rightIdentifier = rightIdentifiers[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;
    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) return Number(leftIdentifier) - Number(rightIdentifier);
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftIdentifier.localeCompare(rightIdentifier);
  }
  return 0;
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const result = await crypto.subtle.digest("SHA-256", buffer);
  const value = Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${value}`;
}

/**
 * 功能说明：提供与正式 HTTP 接口相同边界的内存模拟实现。
 * 构造参数 options - 控制模拟延迟和初始登录用户。
 */
export class MockSkillApi implements SkillApi {
  private readonly delayMs: number;
  private readonly skills = clone(mockSkillDetails);
  private readonly versions = new Map(
    Object.entries(mockVersions).map(([skillId, versions]) => [skillId, clone(versions)]),
  );
  private readonly tags = clone(mockTags);
  private readonly inspections = new Map<string, StoredInspection>();
  private readonly versionFiles = new Map<string, StoredVersionFileSource>(
    Object.entries(mockVersionFiles).map(([versionId, source]) => [versionId, clone(source)]),
  );
  private readonly installationEvents = new Set<string>();
  private currentUser: UserDto | null;

  constructor(options: MockSkillApiOptions = {}) {
    this.delayMs = options.delayMs ?? 280;
    this.currentUser = options.initialUser ?? null;
  }

  private async wait(): Promise<void> {
    await new Promise((resolve) => globalThis.setTimeout(resolve, this.delayMs));
  }

  private requireUser(): UserDto {
    if (!this.currentUser) {
      throw new SkillApiError("UNAUTHENTICATED", "请先登录后再继续操作");
    }
    if (this.currentUser.status === "DISABLED") {
      throw new SkillApiError("USER_DISABLED", "当前用户已停用，请联系管理员");
    }
    return this.currentUser;
  }

  private findSkill(skillId: string): SkillDetailDto {
    const skill = this.skills.find((item) => item.id === skillId);
    if (!skill) {
      throw new SkillApiError("SKILL_NOT_FOUND", "没有找到该 Skill");
    }
    return skill;
  }

  private findVersion(skillId: string, versionId: string): SkillVersionDto {
    this.findSkill(skillId);
    const version = (this.versions.get(skillId) ?? []).find((item) => item.id === versionId);
    if (!version) {
      throw new SkillApiError("VERSION_NOT_FOUND", "没有找到该 Skill 版本");
    }
    return version;
  }

  private getInspection(uploadId: string): StoredInspection {
    const inspection = this.inspections.get(uploadId);
    if (!inspection) {
      throw new SkillApiError("UPLOAD_NOT_FOUND", "没有找到临时上传记录，请重新选择 ZIP");
    }
    if (inspection.used) {
      throw new SkillApiError("UPLOAD_ALREADY_USED", "该上传记录已经发布，请重新选择 ZIP");
    }
    if (new Date(inspection.data.expiresAt).getTime() <= Date.now()) {
      throw new SkillApiError("UPLOAD_EXPIRED", "临时上传已过期，请重新选择 ZIP");
    }
    return inspection;
  }

  private resolveTags(tagIds: string[], newTagNames: string[]): TagDto[] {
    const selected = this.tags.filter((tag) => tagIds.includes(tag.id));
    const normalizedNames = newTagNames.map((name) => name.trim()).filter(Boolean);
    for (const name of normalizedNames) {
      let tag = this.tags.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (!tag) {
        tag = { id: crypto.randomUUID(), name };
        this.tags.push(tag);
      }
      if (!selected.some((item) => item.id === tag.id)) {
        selected.push(tag);
      }
    }
    if (selected.length > 5) {
      throw new SkillApiError("INVALID_REQUEST", "每个 Skill 最多选择 5 个 Tag");
    }
    return selected;
  }

  async listSkills(query: ListSkillsQuery = {}): Promise<SkillListResponseDto> {
    await this.wait();
    const keyword = query.q?.trim().toLocaleLowerCase() ?? "";
    let items = this.skills.filter((skill) => {
      const searchable = [skill.skillName, skill.displayName, skill.skillDescription, skill.displayDescription, ...skill.tags.map((tag) => tag.name)].join(" ").toLocaleLowerCase();
      const matchesTag = !query.tagId || skill.tags.some((tag) => tag.id === query.tagId);
      return matchesTag && searchable.includes(keyword);
    });
    const sort = query.sort ?? "updated";
    items = [...items].sort((left, right) => {
      if (sort === "popular") return right.installCount - left.installCount;
      if (sort === "created") return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    return { items: clone(items.slice(start, start + pageSize)), total: items.length, page, pageSize };
  }

  async getSkill(skillId: string): Promise<SkillDetailDto> {
    await this.wait();
    return clone(this.findSkill(skillId));
  }

  async listTags(query = ""): Promise<TagDto[]> {
    await this.wait();
    const keyword = query.trim().toLocaleLowerCase();
    return clone(this.tags.filter((tag) => tag.name.toLocaleLowerCase().includes(keyword)));
  }

  async listSkillVersions(skillId: string, query: ListVersionsQuery = {}): Promise<SkillVersionListResponseDto> {
    await this.wait();
    this.findSkill(skillId);
    const versions = this.versions.get(skillId) ?? [];
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    return { items: clone(versions.slice(start, start + pageSize)), total: versions.length, page, pageSize };
  }

  async listVersionFiles(skillId: string, versionId: string): Promise<SkillFileListResponseDto> {
    await this.wait();
    this.findVersion(skillId, versionId);
    const source = this.versionFiles.get(versionId);
    if (!source) throw new SkillApiError("FILE_NOT_FOUND", "没有找到该版本的文件清单");
    return { items: clone(source.files) };
  }

  async getVersionFileContent(
    skillId: string,
    versionId: string,
    path: string,
  ): Promise<SkillFileContentDto> {
    await this.wait();
    this.findVersion(skillId, versionId);
    const source = this.versionFiles.get(versionId);
    if (!source) throw new SkillApiError("FILE_NOT_FOUND", "没有找到该版本的文件清单");

    if ("archive" in source) {
      const result = await readArchiveText(source, path);
      return { path, mediaType: result.mediaType, encoding: "UTF-8", size: result.size, content: result.content };
    }
    const file = source.files.find((entry) => entry.path === path && entry.type === "FILE");
    if (!file) throw new SkillApiError("FILE_NOT_FOUND", "没有找到该版本中的文件", { path });
    if (!file.previewable || !file.mediaType || source.contents[path] === undefined) {
      throw new SkillApiError("FILE_PREVIEW_UNAVAILABLE", "该文件类型不支持文本预览", { path });
    }
    const content = source.contents[path];
    return {
      path,
      mediaType: file.mediaType,
      encoding: "UTF-8",
      size: new TextEncoder().encode(content).byteLength,
      content,
    };
  }

  async inspectUpload(file: File): Promise<UploadInspectionDto> {
    await this.wait();
    this.requireUser();
    if (!file.name.toLocaleLowerCase().endsWith(".zip")) {
      throw new SkillApiError("INVALID_SKILL_PACKAGE", "请选择 ZIP 格式的 Skill 包");
    }
    if (file.size > MAX_PACKAGE_SIZE) {
      throw new SkillApiError("PACKAGE_TOO_LARGE", "ZIP 不能超过 50 MB");
    }
    const buffer = await file.arrayBuffer();
    const parsed = await inspectSkillZip(buffer);
    const packageSha256 = await sha256(buffer);
    const data: UploadInspectionDto = {
      uploadId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      originalFileName: file.name,
      skillName: parsed.skillName,
      skillDescription: parsed.skillDescription,
      skillMd: parsed.skillMd,
      packageSize: file.size,
      fileCount: parsed.files.filter((entry) => entry.type === "FILE").length,
      packageSha256,
      contentHash: parsed.contentHash,
      warnings: [],
    };
    const inspection: StoredInspection = {
      data,
      source: {
        archive: parsed.archive,
        files: parsed.files,
        originalPathByNormalized: parsed.originalPathByNormalized,
      },
      used: false,
    };
    this.inspections.set(data.uploadId, inspection);
    console.info("[MockSkillApi] ZIP 解析完成", { uploadId: data.uploadId, skillName: data.skillName });
    return clone(data);
  }

  async createSkill(input: CreateSkillDto): Promise<SkillDetailDto> {
    await this.wait();
    const user = this.requireUser();
    const inspection = this.getInspection(input.uploadId);
    const inspectionData = inspection.data;
    if (!SEMVER_PATTERN.test(input.version)) {
      throw new SkillApiError("INVALID_SEMVER", "版本号必须使用 SemVer，例如 1.0.0");
    }
    const duplicate = this.skills.find((skill) => skill.skillName === inspectionData.skillName);
    if (duplicate) {
      throw new SkillApiError("DUPLICATE_SKILL_NAME", "该 Skill 名称已经存在，请发布为新版本", { skillId: duplicate.id });
    }
    const now = new Date().toISOString();
    const skillId = crypto.randomUUID();
    const version: SkillVersionDto = {
      id: crypto.randomUUID(), version: input.version, skillName: inspectionData.skillName,
      skillDescription: inspectionData.skillDescription, changelog: input.changelog ?? null,
      packageSize: inspectionData.packageSize, packageSha256: inspectionData.packageSha256,
      contentHash: inspectionData.contentHash, skillMd: inspectionData.skillMd, publishedAt: now, uploadedBy: user,
    };
    const skill: SkillDetailDto = {
      id: skillId, skillName: inspectionData.skillName, displayName: input.displayName,
      skillDescription: inspectionData.skillDescription, displayDescription: input.displayDescription,
      tags: this.resolveTags(input.tags.tagIds, input.tags.newTagNames), latestVersion: version,
      uploadedBy: user, updatedBy: user, installCount: 0, createdAt: now, updatedAt: now,
    };
    this.skills.unshift(skill);
    this.versions.set(skillId, [version]);
    this.versionFiles.set(version.id, inspection.source);
    inspection.used = true;
    console.info("[MockSkillApi] Skill 创建完成", { skillId, version: input.version });
    return clone(skill);
  }

  async updateSkillMetadata(skillId: string, input: UpdateSkillMetadataDto): Promise<SkillDetailDto> {
    await this.wait();
    const user = this.requireUser();
    const skill = this.findSkill(skillId);
    if (skill.uploadedBy.id !== user.id) {
      throw new SkillApiError("NOT_SKILL_OWNER", "只有原上传者可以修改展示信息和 Tag");
    }
    if (input.displayName !== undefined) skill.displayName = input.displayName;
    if (input.displayDescription !== undefined) skill.displayDescription = input.displayDescription;
    if (input.tags !== undefined) skill.tags = this.resolveTags(input.tags.tagIds, input.tags.newTagNames);
    skill.updatedBy = user;
    skill.updatedAt = new Date().toISOString();
    console.info("[MockSkillApi] Skill 平台信息已更新", { skillId });
    return clone(skill);
  }

  async publishSkillVersion(skillId: string, input: PublishSkillVersionDto): Promise<SkillDetailDto> {
    await this.wait();
    const user = this.requireUser();
    const skill = this.findSkill(skillId);
    const inspection = this.getInspection(input.uploadId);
    const inspectionData = inspection.data;
    if (inspectionData.skillName !== skill.skillName) {
      throw new SkillApiError("SKILL_NAME_MISMATCH", "ZIP 中的 Skill 名称与目标 Skill 不一致，建议发布为新的 Skill", { expectedSkillName: skill.skillName, actualSkillName: inspectionData.skillName });
    }
    if (!SEMVER_PATTERN.test(input.version)) {
      throw new SkillApiError("INVALID_SEMVER", "版本号必须使用 SemVer，例如 1.2.0");
    }
    const versions = this.versions.get(skillId) ?? [];
    if (versions.some((version) => version.version === input.version)) {
      throw new SkillApiError("VERSION_ALREADY_EXISTS", "该版本号已经存在");
    }
    if (compareSemVer(input.version, skill.latestVersion.version) <= 0) {
      throw new SkillApiError("VERSION_NOT_GREATER", "新版本必须高于当前最新版本");
    }
    const version: SkillVersionDto = {
      id: crypto.randomUUID(), version: input.version, skillName: inspectionData.skillName,
      skillDescription: inspectionData.skillDescription, changelog: input.changelog,
      packageSize: inspectionData.packageSize, packageSha256: inspectionData.packageSha256,
      contentHash: inspectionData.contentHash, skillMd: inspectionData.skillMd,
      publishedAt: new Date().toISOString(), uploadedBy: user,
    };
    versions.unshift(version);
    this.versions.set(skillId, versions);
    this.versionFiles.set(version.id, inspection.source);
    skill.skillDescription = version.skillDescription;
    skill.latestVersion = version;
    skill.updatedBy = user;
    skill.updatedAt = version.publishedAt;
    inspection.used = true;
    console.info("[MockSkillApi] Skill 新版本已发布", { skillId, version: input.version });
    return clone(skill);
  }

  async getDownloadTicket(skillId: string, versionId: string): Promise<DownloadTicketDto> {
    await this.wait();
    this.requireUser();
    this.findSkill(skillId);
    const version = (this.versions.get(skillId) ?? []).find((item) => item.id === versionId);
    if (!version) throw new SkillApiError("VERSION_NOT_FOUND", "没有找到该 Skill 版本");
    return {
      url: `https://mock.kocotree.local/skills/${skillId}/${versionId}.zip`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      packageSize: version.packageSize, packageSha256: version.packageSha256, contentHash: version.contentHash,
    };
  }

  async recordInstallation(skillId: string, versionId: string, event: InstallationEventDto): Promise<InstallationEventResponseDto> {
    await this.wait();
    this.requireUser();
    const skill = this.findSkill(skillId);
    const versionExists = (this.versions.get(skillId) ?? []).some((item) => item.id === versionId);
    if (!versionExists) throw new SkillApiError("VERSION_NOT_FOUND", "没有找到该 Skill 版本");
    const recorded = !this.installationEvents.has(event.eventId);
    if (recorded) {
      this.installationEvents.add(event.eventId);
      skill.installCount += 1;
    }
    return { recorded, installCount: skill.installCount };
  }

  async getCurrentUser(): Promise<UserDto | null> {
    await this.wait();
    return clone(this.currentUser);
  }

  async signIn(): Promise<UserDto> {
    await this.wait();
    this.currentUser = clone(mockUsers.current);
    console.info("[MockSkillApi] 模拟飞书登录完成", { userId: this.currentUser.id });
    return clone(this.currentUser);
  }

  async signOut(): Promise<void> {
    await this.wait();
    console.info("[MockSkillApi] 模拟用户退出登录");
    this.currentUser = null;
  }
}
