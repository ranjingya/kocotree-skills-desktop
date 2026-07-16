import type { components, operations } from "./schema";

export type ApiErrorDto = components["schemas"]["ApiError"];
export type UserDto = components["schemas"]["User"];
export type TagDto = components["schemas"]["Tag"];
export type SkillSummaryDto = components["schemas"]["SkillSummary"];
export type SkillDetailDto = components["schemas"]["SkillDetail"];
export type SkillVersionDto = components["schemas"]["SkillVersion"];
export type SkillListResponseDto = components["schemas"]["SkillListResponse"];
export type SkillVersionListResponseDto = components["schemas"]["SkillVersionListResponse"];
export type UploadInspectionDto = components["schemas"]["UploadInspection"];
export type CreateSkillDto = components["schemas"]["CreateSkillRequest"];
export type PublishSkillVersionDto = components["schemas"]["CreateSkillVersionRequest"];
export type UpdateSkillMetadataDto = components["schemas"]["UpdateSkillMetadataRequest"];
export type DownloadTicketDto = components["schemas"]["DownloadTicket"];
export type InstallationEventDto = components["schemas"]["InstallationEventRequest"];
export type InstallationEventResponseDto = components["schemas"]["InstallationEventResponse"];
export type SkillFileEntryDto = components["schemas"]["SkillFileEntry"];
export type SkillFileListResponseDto = components["schemas"]["SkillFileListResponse"];
export type SkillFileContentDto = components["schemas"]["SkillFileContent"];

export type ListSkillsQuery = NonNullable<operations["listSkills"]["parameters"]["query"]>;
export type ListVersionsQuery = NonNullable<
  operations["listSkillVersions"]["parameters"]["query"]
>;

/** 客户端本地安装状态，不属于服务端 Skill DTO。 */
export type LocalSkillStatus =
  | "NOT_INSTALLED"
  | "INSTALLED"
  | "MODIFIED"
  | "UNKNOWN_SOURCE"
  | "MISSING";

/** 客户端合并展示用的本地安装记录。 */
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

/**
 * 功能说明：约束模拟接口和未来 HTTP 接口共同实现的业务能力。
 * 返回值：各方法均返回与 OpenAPI 契约一致的异步结果。
 */
export interface SkillApi {
  listSkills(query?: ListSkillsQuery): Promise<SkillListResponseDto>;
  getSkill(skillId: string): Promise<SkillDetailDto>;
  listTags(query?: string): Promise<TagDto[]>;
  listSkillVersions(
    skillId: string,
    query?: ListVersionsQuery,
  ): Promise<SkillVersionListResponseDto>;
  listVersionFiles(skillId: string, versionId: string): Promise<SkillFileListResponseDto>;
  getVersionFileContent(
    skillId: string,
    versionId: string,
    path: string,
  ): Promise<SkillFileContentDto>;
  inspectUpload(file: File): Promise<UploadInspectionDto>;
  createSkill(input: CreateSkillDto): Promise<SkillDetailDto>;
  updateSkillMetadata(
    skillId: string,
    input: UpdateSkillMetadataDto,
  ): Promise<SkillDetailDto>;
  publishSkillVersion(
    skillId: string,
    input: PublishSkillVersionDto,
  ): Promise<SkillDetailDto>;
  getDownloadTicket(skillId: string, versionId: string): Promise<DownloadTicketDto>;
  recordInstallation(
    skillId: string,
    versionId: string,
    event: InstallationEventDto,
  ): Promise<InstallationEventResponseDto>;
  getCurrentUser(): Promise<UserDto | null>;
  signIn(): Promise<UserDto>;
  signOut(): Promise<void>;
}

/** 模拟接口返回的结构化业务错误。 */
export class SkillApiError extends Error {
  readonly code: ApiErrorDto["error"];
  readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorDto["error"],
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SkillApiError";
    this.code = code;
    this.details = details;
  }
}
