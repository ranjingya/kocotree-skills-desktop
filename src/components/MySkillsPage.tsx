import { useEffect, useState } from "react";
import { Button, Spin } from "@douyinfe/semi-ui";
import {
  localSkillService,
  skillApi,
  SkillApiError,
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
  const [localSkills, setLocalSkills] = useState<LocalSkillRecord[]>([]);
  const [onlineSkills, setOnlineSkills] = useState<SkillSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    localSkillService.scanSkills().then((items) => {
      if (active) setLocalSkills(items);
    }).catch((reason: unknown) => {
      console.error("[KocotreeSkills] 本地 Skill 扫描失败", reason);
      if (active) setError("本地 Skill 暂时无法读取");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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
          <button className={domain === "local" ? "active" : ""} type="button" onClick={() => setDomain("local")}>本地</button>
          <button className={domain === "online" ? "active" : ""} type="button" onClick={() => setDomain("online")}>在线</button>
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
      </section>

      {domain === "online" && !currentUser ? (
        <section className="empty-state my-skills-login">
          <AppIcon name="library" size={30} />
          <strong>登录后查看在线 Skill</strong>
          <span>本地 Skill 无需登录即可管理</span>
          <Button theme="solid" type="primary" onClick={onLogin}>模拟飞书登录</Button>
        </section>
      ) : loading ? (
        <section className="empty-state"><Spin /><strong>正在读取 Skill</strong></section>
      ) : error ? (
        <section className="empty-state"><strong>暂时无法加载</strong><span>{error}</span></section>
      ) : domain === "local" ? (
        <section className="my-skills-list">
          {localSkills.map((skill) => (
            <article className="my-skill-row" key={skill.id}>
              <span className="skill-logo skill-logo-green">{skill.skillName.slice(0, 2).toUpperCase()}</span>
              <div className="my-skill-main"><strong>{skill.displayName}</strong><code>{skill.skillName}</code><small>{skill.installPath}</small></div>
              <span className={`local-status local-status-${skill.status.toLocaleLowerCase()}`}>{localStatusLabels[skill.status]}</span>
              <span className="my-skill-version">{skill.version ? `v${skill.version}` : "未关联版本"}</span>
            </article>
          ))}
        </section>
      ) : (
        <section className="my-skills-list">
          {onlineSkills.map((skill) => (
            <button className="my-skill-row online" type="button" key={skill.id} onClick={() => onOpenSkill(skill)}>
              <span className="skill-logo skill-logo-blue">{skill.skillName.slice(0, 2).toUpperCase()}</span>
              <span className="my-skill-main"><strong>{skill.displayName}</strong><code>{skill.skillName}</code><small>{skill.displayDescription}</small></span>
              <span className={`skill-status skill-status-${skill.status.toLocaleLowerCase()}`}>{skill.status === "ACTIVE" ? "使用中" : skill.status === "ARCHIVED" ? "已归档" : "名称冲突"}</span>
              <span className="my-skill-version">v{skill.currentVersion.version}</span>
            </button>
          ))}
          {onlineSkills.length === 0 && <div className="empty-state"><strong>这里还没有 Skill</strong><span>切换其他分类看看</span></div>}
        </section>
      )}
    </main>
  );
}
