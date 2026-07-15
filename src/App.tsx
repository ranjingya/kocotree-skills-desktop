import { useEffect, useState, type FormEvent } from "react";
import { skillApi, SkillApiError, type SkillSummaryDto, type TagDto } from "./api";
import { AppIcon } from "./components/AppIcon";
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
        <div className="skill-title-group">
          <span className={`skill-logo skill-logo-${tone}`}>
            {getSkillShortCode(skill)}
          </span>
          <strong title={skill.displayName}>{skill.displayName}</strong>
        </div>
        <button className="icon-button external-button" type="button" aria-label="查看 Skill 详情" onClick={(event) => { event.stopPropagation(); onOpen(skill); }}>
          <AppIcon name="external" size={17} />
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
}: {
  installedSkillIds: Set<string>;
  onInstall: (skill: SkillSummaryDto) => void;
  onOpen: (skill: SkillSummaryDto) => void;
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
  }, [query, sort, tagId]);

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
          <span>换一个关键词或来源试试</span>
        </section>
      )}
    </main>
  );
}

/**
 * 功能说明：渲染 Skill 上传页面框架并收集首版发布所需信息。
 * @returns Skill 上传页面的 React 元素。
 */
function UploadPage() {
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState("");

  /**
   * 功能说明：提交上传表单，当前阶段记录表单流程并显示接口待接入提示。
   * @param event - React 表单提交事件。
   * @returns 无返回值。
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    console.info("[KocotreeSkills] 提交 Skill 上传表单", { fileName });
    setNotice("页面框架已完成，接入后端接口后将在这里上传并发布新版本。");
  }

  return (
    <main className="page-content upload-page">
      <header className="page-heading">
        <h1>上传 Skill</h1>
        <p>发布新的 Skill，或为已有 Skill 上传更新版本</p>
      </header>

      <form className="upload-panel" onSubmit={handleSubmit}>
        <div className="form-section-heading">
          <span className="section-number">1</span>
          <div>
            <h2>基本信息</h2>
            <p>这些信息会展示在 Skill 浏览页面</p>
          </div>
        </div>

        <div className="form-grid">
          <label className="field field-wide">
            <span>Skill 名称</span>
            <input name="name" required placeholder="例如：代码审查助手" />
          </label>
          <label className="field">
            <span>版本号</span>
            <input name="version" required defaultValue="1.0.0" />
          </label>
          <label className="field">
            <span>来源</span>
            <input name="source" required placeholder="例如：研发效能组" />
          </label>
          <label className="field field-wide">
            <span>简短说明</span>
            <textarea name="description" required placeholder="说明这个 Skill 可以解决什么问题" />
          </label>
        </div>

        <div className="form-divider" />

        <div className="form-section-heading">
          <span className="section-number">2</span>
          <div>
            <h2>Skill 文件</h2>
            <p>压缩包根目录必须包含 SKILL.md</p>
          </div>
        </div>

        <label className="file-dropzone">
          <input
            type="file"
            accept=".zip"
            onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
          />
          <span className="dropzone-icon"><AppIcon name="upload" size={25} /></span>
          <strong>{fileName || "拖入 Skill ZIP，或点击选择文件"}</strong>
          <small>{fileName ? "已选择文件" : "仅支持 .zip 文件"}</small>
        </label>

        {notice && <div className="form-notice">{notice}</div>}

        <div className="form-actions">
          <button className="secondary-button" type="reset" onClick={() => setFileName("")}>
            清空
          </button>
          <button className="primary-button" type="submit">
            <AppIcon name="upload" size={17} />上传 Skill
          </button>
        </div>
      </form>
    </main>
  );
}

/**
 * 功能说明：渲染 Kocotree Skills 客户端外壳，并管理浏览、上传与安装演示状态。
 * @returns 应用主界面的 React 元素。
 */
function App() {
  const [activePage, setActivePage] = useState<PageKey>("browse");
  const [installedSkillIds, setInstalledSkillIds] = useState(
    () => new Set(["0c9c2f8d-3e84-4c0c-8a15-d41d87fd1001", "0c9c2f8d-3e84-4c0c-8a15-d41d87fd1002"]),
  );

  /**
   * 功能说明：切换指定 Skill 的本地安装演示状态。
   * @param skill - 用户点击安装按钮的 Skill。
   * @returns 无返回值。
   */
  function handleInstall(skill: SkillSummaryDto): void {
    setInstalledSkillIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(skill.id)) {
        console.info("[KocotreeSkills] Skill 已处于安装状态", { skillId: skill.id });
        return nextIds;
      }

      console.info("[KocotreeSkills] 准备安装 Skill", {
        skillId: skill.id,
        target: "~/.agents/skills",
      });
      nextIds.add(skill.id);
      return nextIds;
    });
  }

  function handleOpenSkill(skill: SkillSummaryDto): void {
    console.info("[KocotreeSkills] 准备打开 Skill 详情", { skillId: skill.id });
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
            onClick={() => setActivePage("upload")}
          >
            <AppIcon name="upload" size={20} />
            <span>上传 Skill</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="connection-dot" />
          <div>
            <strong>本地开发模式</strong>
            <small>服务端待接入</small>
          </div>
        </div>
      </aside>

      <div className="main-area">
        {activePage === "browse" ? (
          <BrowsePage installedSkillIds={installedSkillIds} onInstall={handleInstall} onOpen={handleOpenSkill} />
        ) : (
          <UploadPage />
        )}
      </div>
    </div>
  );
}

export default App;
