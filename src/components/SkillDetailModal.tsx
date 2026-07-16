import { useEffect, useState } from "react";
import { Button, Modal, Select, Spin, TabPane, Tabs, Tag } from "@douyinfe/semi-ui";
import {
  skillApi,
  SkillApiError,
  type SkillDetailDto,
  type SkillFileContentDto,
  type SkillFileEntryDto,
  type SkillSummaryDto,
  type SkillVersionDto,
} from "../api";
import { AppIcon } from "./AppIcon";

interface SkillDetailModalProps {
  skill: SkillSummaryDto | null;
  installedSkillIds: Set<string>;
  onClose: () => void;
  onInstall: (skill: SkillSummaryDto, version: SkillVersionDto) => void;
  onUploadVersion: (skill: SkillSummaryDto) => void;
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
function orderFileEntries(entries: SkillFileEntryDto[]): SkillFileEntryDto[] {
  const childrenByParent = new Map<string, SkillFileEntryDto[]>();
  for (const entry of entries) {
    const separatorIndex = entry.path.lastIndexOf("/");
    const parentPath = separatorIndex >= 0 ? entry.path.slice(0, separatorIndex) : "";
    const children = childrenByParent.get(parentPath) ?? [];
    children.push(entry);
    childrenByParent.set(parentPath, children);
  }

  const ordered: SkillFileEntryDto[] = [];
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
  onClose,
  onInstall,
  onUploadVersion,
}: SkillDetailModalProps) {
  const [detail, setDetail] = useState<SkillDetailDto | null>(null);
  const [versions, setVersions] = useState<SkillVersionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileVersionId, setFileVersionId] = useState("");
  const [fileEntries, setFileEntries] = useState<SkillFileEntryDto[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [fileContent, setFileContent] = useState<SkillFileContentDto | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [fileError, setFileError] = useState("");

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
        setFileVersionId(nextDetail.latestVersion.id);
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
        setFileEntries(result.items);
        const defaultFile = result.items.find((entry) => entry.path === "SKILL.md")
          ?? result.items.find((entry) => entry.type === "FILE" && entry.previewable);
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

  return (
    <Modal
      className="skill-detail-modal"
      title={detail?.displayName ?? skill?.displayName ?? "Skill 详情"}
      visible={skill !== null}
      width={760}
      centered
      onCancel={onClose}
      footer={detail ? (
        <div className="detail-footer">
          <Button
            className="detail-secondary-action"
            theme="light"
            type="tertiary"
            onClick={() => onUploadVersion(detail)}
          >
            上传新版本
          </Button>
          <Button
            theme="solid"
            type="primary"
            icon={<AppIcon name={installedSkillIds.has(detail.id) ? "check" : "download"} size={16} />}
            onClick={() => onInstall(detail, detail.latestVersion)}
          >
            {installedSkillIds.has(detail.id) ? "重新安装最新版" : "安装最新版"}
          </Button>
        </div>
      ) : null}
    >
      {loading ? (
        <div className="detail-loading"><Spin size="large" tip="正在加载详情…" /></div>
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
          </div>
          <p className="detail-description">{detail.displayDescription}</p>
          <div className="detail-tags">
            {detail.tags.map((tag) => <Tag color="green" key={tag.id}>{tag.name}</Tag>)}
          </div>
          <div className="detail-stats">
            <div><span>最新版本</span><strong>v{detail.latestVersion.version}</strong></div>
            <div><span>安装次数</span><strong>{detail.installCount.toLocaleString("zh-CN")}</strong></div>
            <div><span>原上传者</span><strong>{detail.uploadedBy.name}</strong></div>
          </div>

          <Tabs type="line">
            <TabPane tab="介绍" itemKey="overview">
              <section className="detail-section">
                <h3>Skill 原始说明</h3>
                <p>{detail.skillDescription}</p>
                <dl className="detail-metadata">
                  <div><dt>创建时间</dt><dd>{formatDate(detail.createdAt)}</dd></div>
                  <div><dt>最近更新</dt><dd>{formatDate(detail.updatedAt)}</dd></div>
                  <div><dt>最近更新者</dt><dd>{detail.updatedBy.name}</dd></div>
                  <div><dt>ZIP 大小</dt><dd>{formatFileSize(detail.latestVersion.packageSize)}</dd></div>
                </dl>
              </section>
            </TabPane>
            <TabPane tab={`版本历史 ${versions.length}`} itemKey="versions">
              <div className="version-list">
                {versions.map((version, index) => (
                  <article className="version-item" key={version.id}>
                    <div className="version-main">
                      <div><strong>v{version.version}</strong>{index === 0 && <Tag size="small" color="green">最新</Tag>}</div>
                      <p>{version.changelog ?? "首次发布"}</p>
                      <span>{version.uploadedBy.name} · {formatDate(version.publishedAt)} · {formatFileSize(version.packageSize)}</span>
                    </div>
                    <Button size="small" onClick={() => onInstall(detail, version)}>安装</Button>
                  </article>
                ))}
              </div>
            </TabPane>
            <TabPane tab="查看文件树" itemKey="files">
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
                        {selectedFile.mediaType ?? "二进制文件"}
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
            </TabPane>
          </Tabs>
        </div>
      ) : null}
    </Modal>
  );
}
