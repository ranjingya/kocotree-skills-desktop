import { useEffect, useState } from "react";
import { Button, Dropdown, Modal, Select, Spin, TabPane, Tabs, Tag, Toast } from "./ui";
import {
  skillApi,
  SkillApiError,
  type FileEntryDto,
  type SkillDetailDto,
  type SkillFileContentDto,
  type SkillSummaryDto,
  type SkillVersionDto,
  type UserDto,
} from "../api";
import { AppIcon } from "./AppIcon";
import { ReasonActionModal } from "./ReasonActionModal";
import { SkillMetadataModal } from "./SkillMetadataModal";
import { OwnershipTransferModal } from "./OwnershipTransferModal";

interface SkillDetailModalProps {
  skill: SkillSummaryDto | null;
  installedSkillIds: Set<string>;
  currentUser: UserDto | null;
  onClose: () => void;
  onInstall: (skill: SkillSummaryDto, version: SkillVersionDto) => void;
  onUploadVersion: (skill: SkillSummaryDto) => void;
  onChanged: (skill: SkillDetailDto) => void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 功能说明：把扁平文件清单整理为目录在前、子项紧随目录的树形展示顺序。
 * @param entries - 接口返回的规范化文件条目。
 * @returns 适合从上到下渲染的文件条目数组。
 */
function orderFileEntries(entries: FileEntryDto[]): FileEntryDto[] {
  const childrenByParent = new Map<string, FileEntryDto[]>();
  for (const entry of entries) {
    const separatorIndex = entry.path.lastIndexOf("/");
    const parentPath = separatorIndex >= 0 ? entry.path.slice(0, separatorIndex) : "";
    const children = childrenByParent.get(parentPath) ?? [];
    children.push(entry);
    childrenByParent.set(parentPath, children);
  }

  const ordered: FileEntryDto[] = [];
  function appendChildren(parentPath: string): void {
    const children = [...(childrenByParent.get(parentPath) ?? [])].sort((left, right) => {
      if (left.type !== right.type) return left.type === "DIRECTORY" ? -1 : 1;
      return left.path.localeCompare(right.path);
    });
    for (const child of children) {
      ordered.push(child);
      if (child.type === "DIRECTORY") appendChildren(child.path);
    }
  }
  appendChildren("");
  return ordered;
}

/**
 * 功能说明：展示 Skill 平台信息、版本历史、版本文件树和文本文件预览。
 * @param skill - 当前打开的 Skill 摘要，为 null 时关闭模态框。
 * @param installedSkillIds - 客户端已安装 Skill 编号集合。
 * @param onClose - 关闭详情模态框的回调。
 * @param onInstall - 安装指定历史版本的回调。
 * @param onUploadVersion - 进入指定 Skill 新版本上传流程的回调。
 * @returns Skill 详情模态框。
 */
export function SkillDetailModal({
  skill,
  installedSkillIds,
  currentUser,
  onClose,
  onInstall,
  onUploadVersion,
  onChanged,
}: SkillDetailModalProps) {
  const [detail, setDetail] = useState<SkillDetailDto | null>(null);
  const [versions, setVersions] = useState<SkillVersionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileVersionId, setFileVersionId] = useState("");
  const [fileEntries, setFileEntries] = useState<FileEntryDto[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [fileContent, setFileContent] = useState<SkillFileContentDto | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [managementAction, setManagementAction] = useState<{ type: "archive" | "withdraw"; version?: SkillVersionDto } | null>(null);
  const [managementReason, setManagementReason] = useState("");
  const [managementLoading, setManagementLoading] = useState(false);
  const [metadataVisible, setMetadataVisible] = useState(false);
  const [ownershipVisible, setOwnershipVisible] = useState(false);

  useEffect(() => {
    if (!skill) {
      setDetail(null);
      setVersions([]);
      setFileVersionId("");
      setFileEntries([]);
      setSelectedFilePath("");
      setFileContent(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([skillApi.getSkill(skill.id), skillApi.listSkillVersions(skill.id)])
      .then(([nextDetail, versionPage]) => {
        if (!active) return;
        setDetail(nextDetail);
        setVersions(versionPage.items);
        setFileVersionId(nextDetail.currentVersion.id);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        console.error("[KocotreeSkills] Skill 详情加载失败", reason);
        setError(reason instanceof SkillApiError ? reason.message : "详情加载失败，请稍后重试");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [skill]);

  useEffect(() => {
    if (!detail || !fileVersionId) return;
    let active = true;
    setFileTreeLoading(true);
    setFileError("");
    setFileEntries([]);
    setSelectedFilePath("");
    setFileContent(null);
    skillApi.listVersionFiles(detail.id, fileVersionId)
      .then((result) => {
        if (!active) return;
        setFileEntries(result);
        const defaultFile = result.find((entry) => entry.path === "SKILL.md")
          ?? result.find((entry) => entry.type === "FILE" && entry.previewable);
        setSelectedFilePath(defaultFile?.path ?? "");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        console.error("[KocotreeSkills] 版本文件树加载失败", reason);
        setFileError(reason instanceof SkillApiError ? reason.message : "文件树加载失败，请稍后重试");
      })
      .finally(() => {
        if (active) setFileTreeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [detail, fileVersionId]);

  useEffect(() => {
    if (!detail || !fileVersionId || !selectedFilePath) return;
    const selectedFile = fileEntries.find((entry) => entry.path === selectedFilePath);
    setFileError("");
    if (!selectedFile?.previewable) {
      setFileContent(null);
      setFilePreviewLoading(false);
      return;
    }
    let active = true;
    setFilePreviewLoading(true);
    setFileError("");
    setFileContent(null);
    skillApi.getVersionFileContent(detail.id, fileVersionId, selectedFilePath)
      .then((content) => {
        if (active) setFileContent(content);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        console.error("[KocotreeSkills] 版本文件内容加载失败", reason);
        setFileError(reason instanceof SkillApiError ? reason.message : "文件内容加载失败，请稍后重试");
      })
      .finally(() => {
        if (active) setFilePreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [detail, fileEntries, fileVersionId, selectedFilePath]);

  const selectedFile = fileEntries.find((entry) => entry.path === selectedFilePath) ?? null;
  const orderedFileEntries = orderFileEntries(fileEntries);
  const sortedCollaborators = [...(detail?.collaborators ?? [])].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  const canManageSkill = Boolean(detail && currentUser && (currentUser.role === "ADMIN" || detail.owner.id === currentUser.id));
  const canManageVersion = Boolean(detail && currentUser && (currentUser.role === "ADMIN" || detail.owner.id === currentUser.id || detail.collaborators.some((user) => user.id === currentUser.id)));

  async function handleManagementConfirm(): Promise<void> {
    if (!detail || !managementAction || !managementReason.trim()) return;
    setManagementLoading(true);
    try {
      if (managementAction.type === "archive") {
        const updated = await skillApi.archiveSkill(detail.id, { reason: managementReason.trim() });
        setDetail(updated);
        onChanged(updated);
        Toast.success("Skill 已归档");
      } else if (managementAction.version) {
        const updatedVersion = await skillApi.withdrawSkillVersion(detail.id, managementAction.version.id, { reason: managementReason.trim() });
        setVersions((items) => items.map((item) => item.id === updatedVersion.id ? updatedVersion : item));
        const updatedDetail = detail.currentVersion.id === updatedVersion.id ? { ...detail, currentVersion: updatedVersion } : detail;
        setDetail(updatedDetail);
        onChanged(updatedDetail);
        Toast.success(`v${updatedVersion.version} 已撤回`);
      }
      setManagementAction(null);
      setManagementReason("");
    } catch (reason) {
      console.error("[KocotreeSkills] Skill 管理操作失败", reason);
      Toast.error(reason instanceof SkillApiError ? reason.message : "操作失败，请稍后重试");
    } finally {
      setManagementLoading(false);
    }
  }

  async function handleRestore(): Promise<void> {
    if (!detail) return;
    setManagementLoading(true);
    try {
      const updated = await skillApi.restoreSkill(detail.id);
      setDetail(updated);
      onChanged(updated);
      Toast.success("Skill 已恢复");
    } catch (reason) {
      console.error("[KocotreeSkills] Skill 恢复失败", reason);
      Toast.error(reason instanceof SkillApiError ? reason.message : "恢复失败，请稍后重试");
    } finally {
      setManagementLoading(false);
    }
  }

  return (
    <>
    <Modal
      className="skill-detail-modal"
      title={detail?.displayName ?? skill?.displayName ?? "Skill 详情"}
      visible={skill !== null}
      width={900}
      centered
      onCancel={onClose}
      footer={skill ? (
        <div className="detail-footer">
          {detail ? (
            <>
              {detail.status === "ACTIVE" && (
                <Button
                  theme="solid"
                  type="primary"
                  disabled={detail.currentVersion.status !== "PUBLISHED"}
                  icon={installedSkillIds.has(detail.id) ? undefined : <AppIcon name="download" size={16} />}
                  onClick={() => onInstall(detail, detail.currentVersion)}
                >
                  {installedSkillIds.has(detail.id) ? "重新安装最新版" : "安装最新版"}
                </Button>
              )}
              {canManageSkill && detail.status === "ARCHIVED" && (
                <Button theme="solid" type="primary" loading={managementLoading} onClick={() => void handleRestore()}>恢复 Skill</Button>
              )}
              {(detail.status === "ACTIVE" || canManageVersion) && (
                <Dropdown
                  className="detail-more-menu"
                  contentClassName="detail-more-dropdown"
                  position="top"
                  trigger="click"
                  render={(
                    <Dropdown.Menu>
                      {detail.status === "ACTIVE" && (
                        <Dropdown.Item onClick={() => onUploadVersion(detail)}>上传新版本</Dropdown.Item>
                      )}
                      {canManageVersion && (
                        <Dropdown.Item onClick={() => setMetadataVisible(true)}>编辑展示信息</Dropdown.Item>
                      )}
                      {canManageSkill && detail.collaborators.some((user) => user.status === "ACTIVE") && (
                        <Dropdown.Item onClick={() => setOwnershipVisible(true)}>转移所有权</Dropdown.Item>
                      )}
                      {canManageSkill && detail.status === "ACTIVE" && (
                        <Dropdown.Item type="danger" onClick={() => { setManagementReason(""); setManagementAction({ type: "archive" }); }}>归档 Skill</Dropdown.Item>
                      )}
                    </Dropdown.Menu>
                  )}
                >
                  <Button className="detail-more-trigger" aria-label="更多管理操作" icon={<AppIcon name="more" size={18} />} />
                </Dropdown>
              )}
            </>
          ) : <span className="detail-footer-placeholder" aria-hidden="true" />}
        </div>
      ) : null}
    >
      {loading ? (
        <div className="detail-loading"><Spin size="large" /><span>正在加载详情…</span></div>
      ) : error ? (
        <div className="detail-error"><strong>暂时无法显示详情</strong><span>{error}</span></div>
      ) : detail ? (
        <div className="detail-body">
          <div className="detail-identity">
            <span className="skill-logo skill-logo-green">{detail.skillName.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{detail.displayName}</strong>
              <code>{detail.skillName}</code>
            </div>
            {detail.status !== "ACTIVE" && (
              <span className={`detail-status detail-status-${detail.status.toLocaleLowerCase()}`}>
                {detail.status === "ARCHIVED" ? "已归档" : "名称冲突"}
              </span>
            )}
          </div>
          <p className="detail-description">{detail.displayDescription}</p>
          <div className="detail-tags">
            {detail.tags.map((tag) => <Tag color="green" key={tag.id}>{tag.name}</Tag>)}
          </div>
          <div className="detail-stats">
            <div><span>最新版本</span><strong>v{detail.currentVersion.version}</strong></div>
            <div><span>安装次数</span><strong>{detail.installCount.toLocaleString("zh-CN")}</strong></div>
            <div className="detail-maintainers">
              <span>维护成员</span>
              <div className="maintainer-list">
                <span
                  className={detail.owner.status === "DISABLED" ? "owner-avatar disabled" : "owner-avatar"}
                  title={`${detail.owner.name} · ${detail.owner.departmentPath.join(" / ") || "部门信息暂无"}${detail.owner.status === "DISABLED" ? " · 账号已停用" : ""}`}
                >
                  {detail.owner.name.slice(0, 1)}
                </span>
                <strong className="owner-name">{detail.owner.name}</strong>
                <span className="owner-role">Owner</span>
                {sortedCollaborators.length > 0 && <span className="maintainer-divider" aria-hidden="true" />}
                <div className="collaborator-list" aria-label={`协作者 ${sortedCollaborators.length} 人`}>
                  {sortedCollaborators.slice(0, 5).map((user) => (
                    <span
                      className={user.status === "DISABLED" ? "collaborator-avatar disabled" : "collaborator-avatar"}
                      key={user.id}
                      title={`${user.name} · ${user.departmentPath.join(" / ") || "部门信息暂无"}${user.status === "DISABLED" ? " · 账号已停用" : ""}`}
                    >
                      {user.name.slice(0, 1)}
                    </span>
                  ))}
                  {sortedCollaborators.length > 5 && (
                    <span className="collaborator-more" title={`另外 ${sortedCollaborators.length - 5} 位协作者`}>
                      +{sortedCollaborators.length - 5}
                    </span>
                  )}
                  {sortedCollaborators.length === 0 && <small>暂无协作者</small>}
                </div>
              </div>
            </div>
          </div>

          {detail.derivedFrom && (
            <div className="derived-source">
              <span>派生自</span>
              <strong>{detail.derivedFrom.skillName} · v{detail.derivedFrom.version}</strong>
              {!detail.derivedFrom.linkable && <small>来源已归档，无法跳转</small>}
            </div>
          )}

          <Tabs type="line">
            <TabPane tab="介绍" itemKey="overview">
              <section className="detail-section">
                <h3>Skill 原始说明</h3>
                <p>{detail.skillDescription}</p>
                <dl className="detail-metadata">
                  <div><dt>创建时间</dt><dd>{formatDate(detail.createdAt)}</dd></div>
                  <div><dt>最近更新</dt><dd>{formatDate(detail.updatedAt)}</dd></div>
                  <div><dt>最近更新者</dt><dd>{detail.updatedBy.name}</dd></div>
                  <div><dt>ZIP 大小</dt><dd>{formatFileSize(detail.currentVersion.packageSize)}</dd></div>
                </dl>
              </section>
            </TabPane>
            <TabPane tab={`版本历史 ${versions.length}`} itemKey="versions">
              <div className="version-list">
                {versions.map((version) => (
                  <article className="version-item" key={version.id}>
                    <div className="version-main">
                      <div>
                        <strong>v{version.version}</strong>
                        {version.id === detail.currentVersion.id && <Tag size="small" color="green">当前</Tag>}
                        {version.status === "WITHDRAWN" && <Tag size="small" color="red">已撤回</Tag>}
                      </div>
                      <p>{version.changelog}</p>
                      <span>{version.uploadedBy.name} · {formatDate(version.publishedAt)} · {formatFileSize(version.packageSize)}</span>
                      {version.status === "WITHDRAWN" && <span className="withdrawal-reason">撤回原因：{version.withdrawalReason}</span>}
                    </div>
                    <div className="version-actions">
                      {canManageVersion && version.status === "PUBLISHED" && version.version !== "1.0.0" && (
                        <Button size="small" type="danger" theme="borderless" onClick={() => { setManagementReason(""); setManagementAction({ type: "withdraw", version }); }}>撤回</Button>
                      )}
                      <Button size="small" disabled={version.status === "WITHDRAWN" || detail.status !== "ACTIVE"} onClick={() => onInstall(detail, version)}>安装</Button>
                    </div>
                  </article>
                ))}
              </div>
            </TabPane>
            <TabPane tab="文件浏览" itemKey="files">
              <div className="file-tab-content">
                <div className="file-browser-toolbar">
                  <span>版本文件</span>
                  <Select
                    size="small"
                    value={fileVersionId}
                    optionList={versions.map((version) => ({
                      label: `v${version.version}`,
                      value: version.id,
                    }))}
                    onChange={(value) => setFileVersionId(String(value))}
                  />
                </div>
                <div className="file-browser">
                  <div className="file-tree" aria-label="版本文件树">
                    {fileTreeLoading ? (
                      <div className="file-pane-state"><Spin size="small" />正在读取文件树</div>
                    ) : fileEntries.length === 0 ? (
                      <div className="file-pane-state">该版本没有可展示的文件</div>
                    ) : orderedFileEntries.map((entry) => {
                      const segments = entry.path.split("/");
                      const label = segments[segments.length - 1];
                      const depth = segments.length - 1;
                      if (entry.type === "DIRECTORY") {
                        return (
                          <div
                            className="file-tree-directory"
                            style={{ paddingLeft: 11 + depth * 15 }}
                            key={entry.path}
                          >
                            <AppIcon name="folder" size={15} />
                            <span title={entry.path}>{label}</span>
                          </div>
                        );
                      }
                      return (
                        <button
                          className={selectedFilePath === entry.path ? "file-tree-file active" : "file-tree-file"}
                          style={{ paddingLeft: 11 + depth * 15 }}
                          type="button"
                          key={entry.path}
                          onClick={() => setSelectedFilePath(entry.path)}
                        >
                          <AppIcon name="file" size={15} />
                          <span title={entry.path}>{label}</span>
                          {entry.size !== null && <small>{formatFileSize(entry.size)}</small>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="file-preview">
                    {selectedFile ? (
                      <header className="file-preview-heading">
                        <strong title={selectedFile.path}>{selectedFile.path}</strong>
                        <span>
                          {selectedFile.previewable ? "文本文件" : "二进制文件"}
                          {selectedFile.size !== null ? ` · ${formatFileSize(selectedFile.size)}` : ""}
                        </span>
                      </header>
                    ) : null}
                    {filePreviewLoading ? (
                      <div className="file-pane-state"><Spin size="small" />正在读取文件</div>
                    ) : fileError ? (
                      <div className="file-pane-state file-pane-error">{fileError}</div>
                    ) : fileContent ? (
                      <pre className="file-content-preview"><code>{fileContent.content}</code></pre>
                    ) : selectedFile && !selectedFile.previewable ? (
                      <div className="file-pane-state">该文件不是可预览的 UTF-8 文本</div>
                    ) : (
                      <div className="file-pane-state">选择左侧文件查看内容</div>
                    )}
                  </div>
                </div>
              </div>
            </TabPane>
          </Tabs>
        </div>
      ) : null}
    </Modal>
    <ReasonActionModal
      title={managementAction?.type === "withdraw" ? "撤回版本" : "归档 Skill"}
      description={managementAction?.type === "withdraw" ? "撤回后该版本将无法继续安装，本地已经安装的副本仍可使用。" : "归档后 Skill 不再出现在技能广场，本地已经安装的副本仍可使用。"}
      visible={managementAction !== null}
      reason={managementReason}
      loading={managementLoading}
      onReasonChange={setManagementReason}
      onCancel={() => { setManagementAction(null); setManagementReason(""); }}
      onConfirm={() => void handleManagementConfirm()}
    />
    <SkillMetadataModal
      skill={detail}
      currentUser={currentUser}
      visible={metadataVisible}
      onCancel={() => setMetadataVisible(false)}
      onUpdated={(updated) => {
        setMetadataVisible(false);
        setDetail(updated);
        onChanged(updated);
      }}
    />
    <OwnershipTransferModal
      skill={detail}
      visible={ownershipVisible}
      onCancel={() => setOwnershipVisible(false)}
      onCreated={() => setOwnershipVisible(false)}
    />
    </>
  );
}
