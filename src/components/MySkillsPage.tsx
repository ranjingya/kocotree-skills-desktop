import { useEffect, useState, type KeyboardEvent } from "react";
import { Button, Spin } from "./ui";
import {
  localSkillService,
  skillApi,
  SkillApiError,
  type InstallationStatusDto,
  type LocalSkillRecord,
  type SkillSummaryDto,
  type UserDto,
} from "../api";
import { AppIcon } from "./AppIcon";

type Domain = "local" | "online";
type Relation = "OWNED" | "COLLABORATED" | "ARCHIVED";

const localStatusLabels: Record<LocalSkillRecord["status"], string> = {
  PLATFORM_INSTALLED: "平台安装",
  PLATFORM_MODIFIED: "本地已修改",
  PLATFORM_MATCHED: "已匹配平台版本",
  LOCAL_UNKNOWN: "本地 Skill",
  MISSING: "目录缺失",
};

interface LocalSkillView {
  record: LocalSkillRecord;
  onlineStatus: InstallationStatusDto | null;
  onlineUnavailable: boolean;
}

interface StatusBadge {
  key: string;
  label: string;
  tone: "archived" | "conflict" | "withdrawn" | "unavailable";
}

/**
 * 功能说明：把平台生命周期和本地安装版本状态转换为本地列表使用的标签与说明。
 * @param item - 已合并本地记录与在线状态的 Skill。
 * @returns 需要展示的状态标签和补充说明。
 */
function getOnlinePresentation(item: LocalSkillView): { badges: StatusBadge[]; note: string | null } {
  if (item.onlineUnavailable) {
    return { badges: [{ key: "unavailable", label: "在线信息不可用", tone: "unavailable" }], note: "已保留平台凭证，可以重新检查在线状态。" };
  }
  const status = item.onlineStatus;
  if (!status) return { badges: [], note: null };

  const badges: StatusBadge[] = [];
  const notes: string[] = [];
  if (status.status === "ARCHIVED") {
    badges.push({ key: "archived", label: "平台已归档 · 本地可用", tone: "archived" });
    if (status.archiveReason) notes.push(`归档原因：${status.archiveReason}`);
  }
  if (status.status === "NAME_CONFLICT") {
    badges.push({ key: "conflict", label: "名称失效 · 本地可用", tone: "conflict" });
    if (status.nameConflictReason) notes.push(status.nameConflictReason);
  }
  if (status.versionStatus === "WITHDRAWN") {
    badges.push({ key: "withdrawn", label: "当前版本已撤回", tone: "withdrawn" });
    if (status.withdrawalReason) notes.push(`撤回原因：${status.withdrawalReason}`);
    if (status.recommendedVersion) notes.push(`推荐切换至 v${status.recommendedVersion.version}`);
  }
  return { badges, note: notes.length > 0 ? notes.join("；") : null };
}

/**
 * 功能说明：展示当前设备的本地 Skill 和当前用户关联的在线 Skill。
 * @param currentUser - 当前登录用户，匿名状态仅加载本地列表。
 * @param onLogin - 用户请求查看在线列表时触发登录。
 * @param onOpenSkill - 打开在线 Skill 详情的回调。
 * @returns 我的 Skill 页面。
 */
export function MySkillsPage({
  currentUser,
  onLogin,
  onOpenSkill,
}: {
  currentUser: UserDto | null;
  onLogin: () => void;
  onOpenSkill: (skill: SkillSummaryDto) => void;
}) {
  const [domain, setDomain] = useState<Domain>("local");
  const [relation, setRelation] = useState<Relation>("OWNED");
  const [localSkills, setLocalSkills] = useState<LocalSkillView[]>([]);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [onlineSkills, setOnlineSkills] = useState<SkillSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /**
   * 功能说明：通过方向键、Home 和 End 在本地与在线页签之间移动，并同步激活页签。
   * @param event - 当前页签按钮触发的键盘事件。
   * @returns 无返回值。
   */
  function handleDomainTabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    let nextDomain: Domain | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home") {
      nextDomain = "local";
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "End") {
      nextDomain = "online";
    }
    if (!nextDomain) return;
    event.preventDefault();
    setDomain(nextDomain);
    window.requestAnimationFrame(() => document.getElementById(`skill-domain-tab-${nextDomain}`)?.focus());
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    console.info("[KocotreeSkills] 开始扫描本地 Skill 并查询在线状态");
    localSkillService.scanSkills().then(async (items) => {
      const views = await Promise.all(items.map(async (record): Promise<LocalSkillView> => {
        if (!record.skillId) return { record, onlineStatus: null, onlineUnavailable: false };
        try {
          const onlineStatus = await skillApi.getInstallationStatus(record.skillId, record.versionId ?? undefined);
          return { record, onlineStatus, onlineUnavailable: false };
        } catch (reason) {
          console.warn("[KocotreeSkills] 本地 Skill 在线状态查询失败", { skillId: record.skillId, reason });
          return { record, onlineStatus: null, onlineUnavailable: true };
        }
      }));
      if (active) {
        setLocalSkills(views);
        console.info("[KocotreeSkills] 本地 Skill 状态加载完成", { count: views.length });
      }
    }).catch((reason: unknown) => {
      console.error("[KocotreeSkills] 本地 Skill 扫描失败", reason);
      if (active) setError("本地 Skill 暂时无法读取");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [localRefreshKey]);

  useEffect(() => {
    if (domain !== "online" || !currentUser) return;
    let active = true;
    setLoading(true);
    setError("");
    skillApi.listMySkills({ relation }).then((result) => {
      if (active) setOnlineSkills(result.items);
    }).catch((reason: unknown) => {
      console.error("[KocotreeSkills] 在线 Skill 加载失败", reason);
      if (active) setError(reason instanceof SkillApiError ? reason.message : "在线 Skill 暂时无法读取");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser, domain, relation]);

  return (
    <main className="page-content my-skills-page">
      <header className="page-heading"><h1>我的 Skill</h1></header>
      <section className="my-skills-toolbar">
        <div className="domain-tabs" role="tablist" aria-label="Skill 数据来源">
          <button
            id="skill-domain-tab-local"
            className={domain === "local" ? "active" : ""}
            type="button"
            role="tab"
            aria-controls="skill-domain-panel-local"
            aria-selected={domain === "local"}
            tabIndex={domain === "local" ? 0 : -1}
            onClick={() => setDomain("local")}
            onKeyDown={handleDomainTabKeyDown}
          >
            本地
          </button>
          <button
            id="skill-domain-tab-online"
            className={domain === "online" ? "active" : ""}
            type="button"
            role="tab"
            aria-controls="skill-domain-panel-online"
            aria-selected={domain === "online"}
            tabIndex={domain === "online" ? 0 : -1}
            onClick={() => setDomain("online")}
            onKeyDown={handleDomainTabKeyDown}
          >
            在线
          </button>
        </div>
        {domain === "online" && currentUser && (
          <div className="relation-tabs">
            {(["OWNED", "COLLABORATED", "ARCHIVED"] as const).map((item) => (
              <button className={relation === item ? "active" : ""} type="button" key={item} onClick={() => setRelation(item)}>
                {item === "OWNED" ? "我拥有的" : item === "COLLABORATED" ? "我协作的" : "已归档"}
              </button>
            ))}
          </div>
        )}
        {domain === "local" && <Button size="small" loading={loading} onClick={() => setLocalRefreshKey((current) => current + 1)}>重新检查</Button>}
      </section>

      {domain === "online" && !currentUser ? (
        <section id="skill-domain-panel-online" className="empty-state my-skills-login" role="tabpanel" aria-labelledby="skill-domain-tab-online">
          <AppIcon name="library" size={30} />
          <strong>登录后查看在线 Skill</strong>
          <span>本地 Skill 无需登录即可管理</span>
          <Button theme="solid" type="primary" onClick={onLogin}>模拟飞书登录</Button>
        </section>
      ) : loading ? (
        <section id={`skill-domain-panel-${domain}`} className="empty-state" role="tabpanel" aria-labelledby={`skill-domain-tab-${domain}`}><Spin /><strong>正在读取 Skill</strong></section>
      ) : error ? (
        <section id={`skill-domain-panel-${domain}`} className="empty-state" role="tabpanel" aria-labelledby={`skill-domain-tab-${domain}`}><strong>暂时无法加载</strong><span>{error}</span></section>
      ) : domain === "local" ? (
        <section id="skill-domain-panel-local" className="my-skills-list" role="tabpanel" aria-labelledby="skill-domain-tab-local">
          {localSkills.map((item) => {
            const { record } = item;
            const presentation = getOnlinePresentation(item);
            return (
              <article className="my-skill-card" key={record.id}>
                <div className="my-skill-card-heading">
                  <span className="skill-logo skill-logo-green">{record.skillName.slice(0, 2).toUpperCase()}</span>
                  <div className="my-skill-main">
                    <strong>{record.displayName}</strong>
                    <code>{record.skillName}</code>
                    <small>{record.installPath}</small>
                  </div>
                </div>
                {presentation.note && <p className="my-skill-warning">{presentation.note}</p>}
                <div className="my-skill-card-footer">
                  <div className="my-skill-statuses">
                    <span className={`local-status local-status-${record.status.toLocaleLowerCase()}`}>{localStatusLabels[record.status]}</span>
                    {presentation.badges.map((badge) => (
                      <span className={`online-status online-status-${badge.tone}`} key={badge.key}>{badge.label}</span>
                    ))}
                  </div>
                  <span className="my-skill-version">{record.version ? `v${record.version}` : "未关联版本"}</span>
                </div>
              </article>
            );
          })}
          {localSkills.length === 0 && <div className="empty-state my-skills-empty"><strong>这里还没有本地 Skill</strong><span>从技能广场安装后会显示在这里</span></div>}
        </section>
      ) : (
        <section id="skill-domain-panel-online" className="my-skills-list" role="tabpanel" aria-labelledby="skill-domain-tab-online">
          {onlineSkills.map((skill) => (
            <button className="my-skill-card online" type="button" key={skill.id} onClick={() => onOpenSkill(skill)}>
              <span className="my-skill-card-heading">
                <span className="skill-logo skill-logo-blue">{skill.skillName.slice(0, 2).toUpperCase()}</span>
                <span className="my-skill-main"><strong>{skill.displayName}</strong><code>{skill.skillName}</code><small>{skill.displayDescription}</small></span>
              </span>
              <span className="my-skill-card-footer">
                <span className={`skill-status skill-status-${skill.status.toLocaleLowerCase()}`}>{skill.status === "ACTIVE" ? "使用中" : skill.status === "ARCHIVED" ? "已归档" : "名称冲突"}</span>
                <span className="my-skill-version">v{skill.currentVersion.version}</span>
              </span>
            </button>
          ))}
          {onlineSkills.length === 0 && <div className="empty-state my-skills-empty"><strong>这里还没有 Skill</strong><span>切换其他分类看看</span></div>}
        </section>
      )}
    </main>
  );
}
