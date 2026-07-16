import { useEffect, useRef, useState } from "react";
import { Button, Modal, Toast } from "@douyinfe/semi-ui";
import {
  skillApi,
  SkillApiError,
  type SkillSummaryDto,
  type SkillVersionDto,
  type TagDto,
  type UserDto,
} from "./api";
import { AppIcon } from "./components/AppIcon";
import { SkillDetailModal } from "./components/SkillDetailModal";
import { UploadPage } from "./components/UploadPage";
import "./App.css";

type PageKey = "browse" | "upload";
type SortKey = "created" | "updated" | "popular";

const logoTones = ["dark", "blue", "orange", "violet", "green"] as const;

function getSkillShortCode(skill: SkillSummaryDto): string {
  const words = skill.skillName.split("-").filter(Boolean);
  return words.length > 1
    ? words.slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase()
    : skill.skillName.slice(0, 2).toLocaleUpperCase();
}

/**
 * 功能说明：渲染单个 Skill 卡片并提供详情与安装入口。
 * @param skill - 当前卡片展示的技能信息。
 * @param installed - 当前技能是否已安装。
 * @param onInstall - 用户点击安装按钮时调用的回调。
 * @returns Skill 卡片的 React 元素。
 */
function SkillCard({
  skill,
  installed,
  onInstall,
  onOpen,
}: {
  skill: SkillSummaryDto;
  installed: boolean;
  onInstall: (skill: SkillSummaryDto) => void;
  onOpen: (skill: SkillSummaryDto) => void;
}) {
  const tone = logoTones[skill.skillName.length % logoTones.length];
  return (
    <article className="skill-card" onClick={() => onOpen(skill)}>
      <div className="skill-card-topline">
        <button
          className="skill-title-group card-title-button"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(skill);
          }}
        >
          <span className={`skill-logo skill-logo-${tone}`}>
            {getSkillShortCode(skill)}
          </span>
          <span className="skill-title-text">
            <strong title={skill.displayName}>{skill.displayName}</strong>
            <code title={skill.skillName}>{skill.skillName}</code>
          </span>
        </button>
      </div>

      <p className="skill-description">{skill.displayDescription}</p>

      <div className="skill-card-meta">
        <span className="source-badge">@{skill.uploadedBy.name}</span>
        <span className="download-count">
          <AppIcon name="download" size={14} />
          {skill.installCount.toLocaleString("zh-CN")}
        </span>
        <button
          className={installed ? "install-button installed" : "install-button"}
          type="button"
          onClick={(event) => { event.stopPropagation(); onInstall(skill); }}
          aria-label={installed ? `${skill.displayName} 已安装` : `安装 ${skill.displayName}`}
        >
          <AppIcon name={installed ? "check" : "plus"} size={17} />
        </button>
      </div>
    </article>
  );
}

/**
 * 功能说明：渲染 Skill 浏览页面，支持排序、搜索、来源筛选和安装状态演示。
 * @param installedSkillIds - 已安装 Skill 的编号集合。
 * @param onInstall - 用户安装 Skill 时调用的回调。
 * @returns Skill 浏览页面的 React 元素。
 */
function BrowsePage({
  installedSkillIds,
  onInstall,
  onOpen,
  refreshKey,
}: {
  installedSkillIds: Set<string>;
  onInstall: (skill: SkillSummaryDto) => void;
  onOpen: (skill: SkillSummaryDto) => void;
  refreshKey: number;
}) {
  const [query, setQuery] = useState("");
  const [tagId, setTagId] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [skills, setSkills] = useState<SkillSummaryDto[]>([]);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    skillApi.listTags().then((items) => {
      if (active) setTags(items);
    }).catch((reason: unknown) => {
      console.error("[KocotreeSkills] Tag 加载失败", reason);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      skillApi.listSkills({ q: query || undefined, tagId: tagId === "all" ? undefined : tagId, sort })
        .then((result) => {
          if (active) setSkills(result.items);
        })
        .catch((reason: unknown) => {
          if (!active) return;
          console.error("[KocotreeSkills] Skill 列表加载失败", reason);
          setError(reason instanceof SkillApiError ? reason.message : "列表加载失败，请稍后重试");
        })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, refreshKey, sort, tagId]);

  return (
    <main className="page-content">
      <header className="page-heading">
        <h1>Skill 浏览</h1>
      </header>

      <section className="filter-panel" aria-label="Skill 筛选条件">
        <div className="filter-first-row">
          <div className="sort-tabs" role="tablist" aria-label="排序方式">
            <button
              className={sort === "updated" ? "active" : ""}
              type="button"
              onClick={() => setSort("updated")}
            >
              <AppIcon name="clock" size={16} />最近更新
            </button>
            <button
              className={sort === "created" ? "active" : ""}
              type="button"
              onClick={() => setSort("created")}
            >
              <AppIcon name="trend" size={16} />最近创建
            </button>
            <button
              className={sort === "popular" ? "active" : ""}
              type="button"
              onClick={() => setSort("popular")}
            >
              <AppIcon name="hot" size={16} />热门
            </button>
          </div>

          <label className="search-box">
            <AppIcon name="search" size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="搜索 Skill..."
            />
          </label>
        </div>

        <div className="source-row">
          <span>标签</span>
          <button
            className={tagId === "all" ? "source-chip active" : "source-chip"}
            type="button"
            onClick={() => setTagId("all")}
          >
            全部标签
          </button>
          {tags.map((item) => (
            <button
              className={tagId === item.id ? "source-chip active" : "source-chip"}
              type="button"
              key={item.id}
              onClick={() => setTagId(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <section className="empty-state"><span className="loading-dot" /><strong>正在加载 Skill</strong></section>
      ) : error ? (
        <section className="empty-state"><strong>暂时无法加载</strong><span>{error}</span></section>
      ) : skills.length > 0 ? (
        <section className="skill-grid" aria-label="Skill 列表">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installed={installedSkillIds.has(skill.id)}
              onInstall={onInstall}
              onOpen={onOpen}
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <AppIcon name="search" size={30} />
          <strong>没有找到匹配的 Skill</strong>
          <span>换一个关键词或标签试试</span>
        </section>
      )}
    </main>
  );
}

/**
 * 功能说明：渲染 Kocotree Skills 客户端外壳，并管理浏览、上传与安装演示状态。
 * @returns 应用主界面的 React 元素。
 */
function App() {
  const [activePage, setActivePage] = useState<PageKey>("browse");
  const [selectedSkill, setSelectedSkill] = useState<SkillSummaryDto | null>(null);
  const [uploadTargetSkill, setUploadTargetSkill] = useState<SkillSummaryDto | null>(null);
  const [browseRefreshKey, setBrowseRefreshKey] = useState(0);
  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [loginVisible, setLoginVisible] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const protectedActionRef = useRef<(() => void) | null>(null);
  const [installedSkillIds, setInstalledSkillIds] = useState(
    () => new Set(["0c9c2f8d-3e84-4c0c-8a15-d41d87fd1001", "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1002"]),
  );

  useEffect(() => {
    skillApi.getCurrentUser().then(setCurrentUser).catch((reason: unknown) => {
      console.error("[KocotreeSkills] 当前用户状态加载失败", reason);
    });
  }, []);

  /**
   * 功能说明：执行需要身份认证的操作，匿名状态下先保留动作并打开登录弹窗。
   * @param action - 登录成功后需要继续执行的动作。
   * @returns 无返回值。
   */
  function requireAuth(action: () => void): void {
    if (currentUser) {
      action();
      return;
    }
    protectedActionRef.current = action;
    setLoginVisible(true);
  }

  /**
   * 功能说明：完成模拟飞书登录并继续此前被拦截的操作。
   * @returns 无返回值。
   */
  async function handleSignIn(): Promise<void> {
    setLoginLoading(true);
    try {
      const user = await skillApi.signIn();
      setCurrentUser(user);
      setLoginVisible(false);
      Toast.success(`已以 ${user.name} 的身份登录`);
      const nextAction = protectedActionRef.current;
      protectedActionRef.current = null;
      nextAction?.();
    } catch (reason) {
      console.error("[KocotreeSkills] 模拟登录失败", reason);
      Toast.error("登录失败，请稍后重试");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    try {
      await skillApi.signOut();
      setCurrentUser(null);
      setActivePage("browse");
      Toast.success("已退出登录");
    } catch (reason) {
      console.error("[KocotreeSkills] 退出登录失败", reason);
      Toast.error("退出失败，请稍后重试");
    }
  }

  /**
   * 功能说明：切换指定 Skill 的本地安装演示状态。
   * @param skill - 用户点击安装按钮的 Skill。
   * @returns 无返回值。
   */
  function handleInstall(skill: SkillSummaryDto): void {
    requireAuth(() => {
      void installSkillVersion(skill, skill.latestVersion.id, skill.latestVersion.version);
    });
  }

  function handleOpenSkill(skill: SkillSummaryDto): void {
    console.info("[KocotreeSkills] 准备打开 Skill 详情", { skillId: skill.id });
    setSelectedSkill(skill);
  }

  /**
   * 功能说明：通过模拟下载凭证完成指定版本的安装与幂等上报。
   * @param skill - 需要安装的 Skill。
   * @param versionId - 需要安装的版本 UUID。
   * @param version - 需要展示的 SemVer 版本号。
   * @returns 无返回值。
   */
  async function installSkillVersion(
    skill: SkillSummaryDto,
    versionId: string,
    version: string,
  ): Promise<void> {
    Toast.info(`正在准备 ${skill.displayName} v${version}`);
    try {
      const ticket = await skillApi.getDownloadTicket(skill.id, versionId);
      console.info("[KocotreeSkills] 已获取模拟下载凭证", {
        skillId: skill.id,
        versionId,
        packageSize: ticket.packageSize,
        target: "~/.agents/skills",
      });
      const result = await skillApi.recordInstallation(skill.id, versionId, {
        eventId: crypto.randomUUID(),
        deviceId: "mock-windows-device",
        platform: "windows",
        clientVersion: "0.1.0",
        installedAt: new Date().toISOString(),
      });
      setInstalledSkillIds((currentIds) => new Set(currentIds).add(skill.id));
      setBrowseRefreshKey((current) => current + 1);
      Toast.success(`模拟安装完成，正式版将写入 ~/.agents/skills（累计 ${result.installCount} 次）`);
    } catch (reason) {
      console.error("[KocotreeSkills] Skill 模拟安装失败", reason);
      Toast.error(reason instanceof SkillApiError ? reason.message : "安装失败，请稍后重试");
    }
  }

  function handleInstallVersion(skill: SkillSummaryDto, version: SkillVersionDto): void {
    requireAuth(() => {
      void installSkillVersion(skill, version.id, version.version);
    });
  }

  function handleUploadVersion(skill: SkillSummaryDto): void {
    requireAuth(() => {
      console.info("[KocotreeSkills] 进入新版本上传流程", { skillId: skill.id });
      setSelectedSkill(null);
      setUploadTargetSkill(skill);
      setActivePage("upload");
    });
  }

  function handlePublished(skill: SkillSummaryDto): void {
    setBrowseRefreshKey((current) => current + 1);
    setUploadTargetSkill(null);
    setActivePage("browse");
    setSelectedSkill(skill);
    Toast.success(`${skill.displayName} v${skill.latestVersion.version} 发布成功`);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-symbol">K</span>
          <strong>Kocotree 技能广场</strong>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          <button
            className={activePage === "browse" ? "active" : ""}
            type="button"
            onClick={() => setActivePage("browse")}
          >
            <AppIcon name="browse" size={20} />
            <span>Skill 浏览</span>
          </button>
          <button
            className={activePage === "upload" ? "active" : ""}
            type="button"
            onClick={() => requireAuth(() => { setUploadTargetSkill(null); setActivePage("upload"); })}
          >
            <AppIcon name="upload" size={20} />
            <span>上传 Skill</span>
          </button>
        </nav>

        {currentUser ? (
          <button className="sidebar-user" type="button" onClick={() => void handleSignOut()} title="点击退出登录">
            <span className="user-avatar">{currentUser.name.slice(0, 1)}</span>
            <span><strong>{currentUser.name}</strong><small>模拟飞书用户 · 点击退出</small></span>
          </button>
        ) : (
          <button className="sidebar-user" type="button" onClick={() => setLoginVisible(true)}>
            <span className="connection-dot" />
            <span><strong>未登录</strong><small>浏览无需登录 · 点击登录</small></span>
          </button>
        )}
      </aside>

      <div className="main-area">
        {activePage === "browse" ? (
          <BrowsePage
            installedSkillIds={installedSkillIds}
            onInstall={handleInstall}
            onOpen={handleOpenSkill}
            refreshKey={browseRefreshKey}
          />
        ) : (
          <UploadPage
            targetSkill={uploadTargetSkill}
            onCancel={() => { setUploadTargetSkill(null); setActivePage("browse"); }}
            onPublished={handlePublished}
            onSwitchToCreate={() => setUploadTargetSkill(null)}
          />
        )}
      </div>

      <SkillDetailModal
        skill={selectedSkill}
        installedSkillIds={installedSkillIds}
        onClose={() => setSelectedSkill(null)}
        onInstall={handleInstallVersion}
        onUploadVersion={handleUploadVersion}
      />

      <Modal
        className="login-modal"
        title="登录 Kocotree Skills"
        visible={loginVisible}
        onCancel={() => { protectedActionRef.current = null; setLoginVisible(false); }}
        footer={null}
        centered
      >
        <div className="login-content">
          <span className="login-mark">飞</span>
          <div><strong>使用飞书继续</strong><p>安装、上传和发布版本时需要记录操作者身份。</p></div>
          <Button theme="solid" type="primary" loading={loginLoading} block onClick={() => void handleSignIn()}>
            模拟飞书登录
          </Button>
          <small>当前为本地模拟流程，不会打开网页或提交真实账号信息。</small>
        </div>
      </Modal>
    </div>
  );
}

export default App;
