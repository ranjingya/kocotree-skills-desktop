import { useEffect, useState } from "react";
import { Button, SideSheet, Spin, TabPane, Tabs, Tag } from "@douyinfe/semi-ui";
import {
  skillApi,
  SkillApiError,
  type SkillDetailDto,
  type SkillSummaryDto,
  type SkillVersionDto,
} from "../api";
import { AppIcon } from "./AppIcon";

interface SkillDetailSheetProps {
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
 * 功能说明：展示 Skill 平台信息、原始 SKILL.md 和全部历史版本。
 * @param skill - 当前打开的 Skill 摘要，为 null 时关闭抽屉。
 * @param installedSkillIds - 客户端已安装 Skill 编号集合。
 * @param onClose - 关闭详情抽屉的回调。
 * @param onInstall - 安装指定历史版本的回调。
 * @param onUploadVersion - 进入指定 Skill 新版本上传流程的回调。
 * @returns Skill 详情抽屉。
 */
export function SkillDetailSheet({
  skill,
  installedSkillIds,
  onClose,
  onInstall,
  onUploadVersion,
}: SkillDetailSheetProps) {
  const [detail, setDetail] = useState<SkillDetailDto | null>(null);
  const [versions, setVersions] = useState<SkillVersionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!skill) {
      setDetail(null);
      setVersions([]);
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

  return (
    <SideSheet
      className="skill-detail-sheet"
      title={detail?.displayName ?? skill?.displayName ?? "Skill 详情"}
      visible={skill !== null}
      width={620}
      onCancel={onClose}
      footer={detail ? (
        <div className="detail-footer">
          <Button onClick={() => onUploadVersion(detail)}>上传新版本</Button>
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
            <TabPane tab="SKILL.md" itemKey="skill-md">
              <pre className="skill-md-preview"><code>{detail.latestVersion.skillMd}</code></pre>
            </TabPane>
          </Tabs>
        </div>
      ) : null}
    </SideSheet>
  );
}
