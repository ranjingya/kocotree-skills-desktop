import { useMemo, useState, type FormEvent } from "react";
import { AppIcon } from "./components/AppIcon";
import { mockSkills } from "./data/mockSkills";
import type { SkillRecord } from "./types/skill";
import "./App.css";

type PageKey = "browse" | "upload";
type SortKey = "all" | "recent" | "popular";

/**
 * 功能说明：根据关键词、来源和排序方式生成技能浏览列表。
 * @param skills - 需要处理的技能原始列表。
 * @param query - 用户输入的搜索关键词。
 * @param source - 当前选择的技能来源，all 表示全部来源。
 * @param sort - 当前选择的排序方式。
 * @returns 筛选并排序后的新技能列表。
 */
function getVisibleSkills(
  skills: SkillRecord[],
  query: string,
  source: string,
  sort: SortKey,
): SkillRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSkills = skills.filter((skill) => {
    const matchesSource = source === "all" || skill.author === source;
    const searchableText = [skill.name, skill.description, skill.author, ...skill.tags]
      .join(" ")
      .toLocaleLowerCase();

    return matchesSource && searchableText.includes(normalizedQuery);
  });

  if (sort === "popular") {
    return [...visibleSkills].sort((a, b) => b.downloads - a.downloads);
  }

  if (sort === "recent") {
    return [...visibleSkills].reverse();
  }

  return visibleSkills;
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
}: {
  skill: SkillRecord;
  installed: boolean;
  onInstall: (skill: SkillRecord) => void;
}) {
  return (
    <article className="skill-card">
      <div className="skill-card-topline">
        <div className="skill-title-group">
          <span className={`skill-logo skill-logo-${skill.logoTone}`}>
            {skill.shortCode}
          </span>
          <strong title={skill.name}>{skill.name}</strong>
        </div>
        <button className="icon-button external-button" type="button" aria-label="查看 Skill 详情">
          <AppIcon name="external" size={17} />
        </button>
      </div>

      <p className="skill-description">{skill.description}</p>

      <div className="skill-card-meta">
        <span className="source-badge">@{skill.author}</span>
        <span className="download-count">
          <AppIcon name="download" size={14} />
          {skill.downloads.toLocaleString("zh-CN")}
        </span>
        <button
          className={installed ? "install-button installed" : "install-button"}
          type="button"
          onClick={() => onInstall(skill)}
          aria-label={installed ? `${skill.name} 已安装` : `安装 ${skill.name}`}
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
}: {
  installedSkillIds: Set<string>;
  onInstall: (skill: SkillRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<SortKey>("all");
  const sources = useMemo(
    () => Array.from(new Set(mockSkills.map((skill) => skill.author))),
    [],
  );
  const visibleSkills = useMemo(
    () => getVisibleSkills(mockSkills, query, source, sort),
    [query, source, sort],
  );

  return (
    <main className="page-content">
      <header className="page-heading">
        <h1>Skill 浏览</h1>
      </header>

      <section className="filter-panel" aria-label="Skill 筛选条件">
        <div className="filter-first-row">
          <div className="sort-tabs" role="tablist" aria-label="排序方式">
            <button
              className={sort === "all" ? "active" : ""}
              type="button"
              onClick={() => setSort("all")}
            >
              <AppIcon name="clock" size={16} />全部
            </button>
            <button
              className={sort === "recent" ? "active" : ""}
              type="button"
              onClick={() => setSort("recent")}
            >
              <AppIcon name="trend" size={16} />最近更新
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
          <span>来源</span>
          <button
            className={source === "all" ? "source-chip active" : "source-chip"}
            type="button"
            onClick={() => setSource("all")}
          >
            全部来源
          </button>
          {sources.map((item) => (
            <button
              className={source === item ? "source-chip active" : "source-chip"}
              type="button"
              key={item}
              onClick={() => setSource(item)}
            >
              @{item}
            </button>
          ))}
        </div>
      </section>

      {visibleSkills.length > 0 ? (
        <section className="skill-grid" aria-label="Skill 列表">
          {visibleSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installed={installedSkillIds.has(skill.id)}
              onInstall={onInstall}
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
    () => new Set(mockSkills.filter((skill) => skill.installed).map((skill) => skill.id)),
  );

  /**
   * 功能说明：切换指定 Skill 的本地安装演示状态。
   * @param skill - 用户点击安装按钮的 Skill。
   * @returns 无返回值。
   */
  function handleInstall(skill: SkillRecord): void {
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
          <BrowsePage installedSkillIds={installedSkillIds} onInstall={handleInstall} />
        ) : (
          <UploadPage />
        )}
      </div>
    </div>
  );
}

export default App;
