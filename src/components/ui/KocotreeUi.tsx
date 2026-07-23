import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

type ButtonTheme = "solid" | "light" | "borderless";
type ButtonTone = "primary" | "secondary" | "tertiary" | "danger";
type ButtonSize = "small" | "default";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  type?: ButtonTone;
  theme?: ButtonTheme;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  tooltip?: string;
  htmlType?: "button" | "submit" | "reset";
}

interface TooltipProps {
  content: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
  className?: string;
  delay?: number;
  onlyWhenTruncated?: boolean;
}

/**
 * 功能说明：为简短说明提供可访问的悬浮提示，并根据视口空间自动选择上下位置。
 * @param content - Tooltip 展示的纯文本内容。
 * @param children - 触发 Tooltip 的单个可聚焦或可悬浮元素。
 * @param className - Tooltip 触发器外层的附加类名。
 * @param delay - 鼠标悬停后的显示延迟，单位为毫秒。
 * @param onlyWhenTruncated - 是否仅在子元素文本被截断时展示。
 * @returns 支持 Hover、Focus 与 Esc 关闭的 Tooltip。
 */
export function Tooltip({ content, children, className = "", delay = 350, onlyWhenTruncated = false }: TooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  function clearTimer(): void {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function show(immediate: boolean): void {
    clearTimer();
    const contentElement = triggerRef.current?.firstElementChild as HTMLElement | null;
    if (onlyWhenTruncated && contentElement && contentElement.scrollWidth <= contentElement.clientWidth) return;
    if (immediate) {
      setVisible(true);
      return;
    }
    timerRef.current = window.setTimeout(() => setVisible(true), delay);
  }

  function hide(): void {
    clearTimer();
    setVisible(false);
    setPosition(null);
  }

  useLayoutEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;
    const triggerBox = triggerRef.current.getBoundingClientRect();
    const tooltipBox = tooltipRef.current.getBoundingClientRect();
    const edge = 8;
    const gap = 7;
    let top = triggerBox.top - tooltipBox.height - gap;
    if (top < edge) top = triggerBox.bottom + gap;
    const centeredLeft = triggerBox.left + (triggerBox.width - tooltipBox.width) / 2;
    const left = Math.min(Math.max(centeredLeft, edge), window.innerWidth - tooltipBox.width - edge);
    setPosition({ left, top });
  }, [content, visible]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [visible]);

  const describedBy = [children.props["aria-describedby"], visible ? tooltipId : ""].filter(Boolean).join(" ") || undefined;
  const trigger = cloneElement(children, { "aria-describedby": describedBy });
  return (
    <>
      <span
        className={`ui-tooltip-trigger ${className}`}
        ref={triggerRef}
        onMouseEnter={() => show(false)}
        onMouseLeave={hide}
        onFocusCapture={() => show(true)}
        onBlurCapture={hide}
        onKeyDown={(event) => {
          if (event.key === "Escape") hide();
        }}
      >
        {trigger}
      </span>
      {visible && createPortal(
        <span
          className="ui-tooltip"
          id={tooltipId}
          ref={tooltipRef}
          role="tooltip"
          style={{ left: position?.left ?? -9999, top: position?.top ?? -9999 }}
        >
          {content}
        </span>,
        document.body,
      )}
    </>
  );
}

/**
 * 功能说明：渲染 Kocotree 统一按钮，并保持加载状态下的宽度稳定。
 * @param props - 按钮外观、尺寸、状态与原生按钮属性。
 * @returns 统一样式的按钮元素。
 */
export function Button({ type = "secondary", theme = type === "primary" ? "solid" : "light", size = "default", block = false, loading = false, icon, tooltip, disabled, htmlType = "button", className = "", children, ...props }: ButtonProps) {
  const classes = ["ui-button", `ui-button-${type}`, `ui-button-${theme}`, size === "small" ? "ui-button-small" : "", block ? "ui-button-block" : "", className].filter(Boolean).join(" ");
  const button = (
    <button {...props} className={classes} type={htmlType} disabled={disabled || loading} aria-busy={loading || undefined}>
      <span className="ui-button-content">{icon}{children}</span>
      {loading && <span className="ui-button-loading" aria-hidden="true"><Spinner size="small" /></span>}
    </button>
  );
  return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
}

export interface ModalProps {
  visible: boolean;
  title: ReactNode;
  width?: number | string;
  centered?: boolean;
  onCancel: () => void;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
  maskClosable?: boolean;
  closeOnEsc?: boolean;
}

/**
 * 功能说明：渲染固定于视口中央的模态框，管理焦点、滚动锁定和键盘关闭。
 * @param props - 模态框标题、可见状态、尺寸、内容与关闭回调。
 * @returns 可访问的模态框元素；不可见时返回 null。
 */
export function Modal({ visible, title, width, onCancel, footer, className = "", children, maskClosable = true, closeOnEsc = true }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const titleId = useId();

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!visible) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => dialogRef.current?.focus());
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEsc) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [closeOnEsc, visible]);

  if (!visible) return null;
  const style: CSSProperties | undefined = width ? { width } : undefined;
  return (
    <div className={`ui-modal-root ${className}`} role="presentation">
      <div className="ui-modal-mask" onMouseDown={(event) => { if (maskClosable && event.target === event.currentTarget) onCancel(); }}>
        <div ref={dialogRef} className="ui-modal" style={style} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
          <header className="ui-modal-header">
            <h2 id={titleId}>{title}</h2>
            <Tooltip content="关闭弹窗"><button className="ui-modal-close" type="button" aria-label="关闭弹窗" onClick={onCancel}>×</button></Tooltip>
          </header>
          <div className="ui-modal-body">{children}</div>
          {footer != null && <footer className="ui-modal-footer">{footer}</footer>}
        </div>
      </div>
    </div>
  );
}

export interface SelectOption { value: string | number; label: ReactNode; description?: string; disabled?: boolean }
export interface SelectProps {
  value?: string | number;
  placeholder?: string;
  optionList: SelectOption[];
  onChange: (value: string | number) => void;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * 功能说明：渲染支持鼠标和键盘操作的自定义下拉选择器。
 * @param props - 当前值、选项列表、占位文字和变更回调。
 * @returns Kocotree 风格的下拉选择器。
 */
export function Select({ value, placeholder = "请选择", optionList, onChange, size = "default", className = "", disabled = false, "aria-label": ariaLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedIndex = Math.max(0, optionList.findIndex((option) => option.value === value));
  const selected = optionList.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex);
    const handlePointerDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, selectedIndex]);

  function moveActive(direction: 1 | -1): void {
    if (optionList.length === 0) return;
    let next = activeIndex;
    for (let index = 0; index < optionList.length; index += 1) {
      next = (next + direction + optionList.length) % optionList.length;
      if (!optionList[next]?.disabled) break;
    }
    setActiveIndex(next);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) setOpen(true);
      else if (!optionList[activeIndex]?.disabled) {
        onChange(optionList[activeIndex].value);
        setOpen(false);
      }
    }
  }

  return (
    <div ref={rootRef} className={`ui-select ${size === "small" ? "ui-select-small" : ""} ${className}`}>
      <button className="ui-select-trigger" type="button" disabled={disabled} aria-label={ariaLabel} aria-expanded={open} aria-controls={listboxId} aria-haspopup="listbox" onClick={() => setOpen((current) => !current)} onKeyDown={handleTriggerKeyDown}>
        <span className={selected ? "" : "ui-select-placeholder"}>{selected?.label ?? placeholder}</span>
        <span className="ui-select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div id={listboxId} className="ui-select-menu" role="listbox">
          {optionList.map((option, index) => (
            <button className={`ui-select-option ${option.value === value ? "selected" : ""} ${index === activeIndex ? "active" : ""}`} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} key={String(option.value)} onMouseEnter={() => setActiveIndex(index)} onClick={() => { onChange(option.value); setOpen(false); }}>
              <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
              {option.value === value && <span className="ui-select-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Spinner({ size = "default" }: { size?: "small" | "default" | "large" }) {
  return <span className={`ui-spinner ui-spinner-${size}`} role="status" aria-label="正在加载" />;
}

export const Spin = Spinner;

interface TabPaneProps { tab: ReactNode; itemKey: string; children: ReactNode }
export function TabPane(_: TabPaneProps) { return null; }

interface TabsProps {
  children: ReactNode;
  type?: "line";
  className?: string;
  activeKey?: string;
  onChange?: (activeKey: string) => void;
}

/**
 * 功能说明：渲染可访问的标签页导航，并只展示当前面板内容。
 * @param children - TabPane 子项集合。
 * @param className - 标签页根节点的附加类名。
 * @param activeKey - 由外部控制的当前标签页编号。
 * @param onChange - 用户切换标签页后的回调。
 * @returns 标签页导航和当前内容面板。
 */
export function Tabs({ children, className = "", activeKey, onChange }: TabsProps) {
  const panes = Children.toArray(children).filter(isValidElement) as ReactElement<TabPaneProps>[];
  const [internalActiveKey, setInternalActiveKey] = useState(panes[0]?.props.itemKey ?? "");
  const currentActiveKey = activeKey ?? internalActiveKey;
  const activePane = panes.find((pane) => pane.props.itemKey === currentActiveKey) ?? panes[0];

  function handleTabChange(nextActiveKey: string): void {
    setInternalActiveKey(nextActiveKey);
    onChange?.(nextActiveKey);
  }

  return (
    <div className={`ui-tabs ${className}`}>
      <div className="ui-tabs-list" role="tablist">
        {panes.map((pane) => (
          <button className={pane.props.itemKey === activePane?.props.itemKey ? "active" : ""} type="button" role="tab" aria-selected={pane.props.itemKey === activePane?.props.itemKey} key={pane.props.itemKey} onClick={() => handleTabChange(pane.props.itemKey)}>{pane.props.tab}</button>
        ))}
      </div>
      <div className="ui-tabs-content" role="tabpanel">{activePane?.props.children}</div>
    </div>
  );
}

export function Tag({ children, color = "green", size = "default" }: { children: ReactNode; color?: "green" | "red"; size?: ButtonSize }) {
  return <span className={`ui-tag ui-tag-${color} ${size === "small" ? "ui-tag-small" : ""}`}>{children}</span>;
}

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  maxCount?: number;
  autosize?: { minRows?: number; maxRows?: number };
}

export function TextArea({ value, onChange, maxCount, autosize, className = "", ...props }: TextAreaProps) {
  return (
    <span className={`ui-textarea ${className}`}>
      <textarea {...props} value={value} maxLength={maxCount} rows={autosize?.minRows} onChange={(event) => onChange(event.currentTarget.value)} />
      {maxCount && <small>{value.length}/{maxCount}</small>}
    </span>
  );
}

interface DropdownProps {
  render: ReactNode;
  children: ReactElement<{ onClick?: () => void; "aria-expanded"?: boolean }>;
  contentClassName?: string;
  className?: string;
  getPopupContainer?: () => HTMLElement;
  position?: "top";
  trigger?: "click";
}
interface DropdownItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> { type?: "danger"; icon?: ReactNode }
function DropdownMenu({ children }: { children: ReactNode }) { return <div className="ui-dropdown-menu" role="menu">{children}</div>; }
function DropdownItem({ type, icon, className = "", children, ...props }: DropdownItemProps) { return <button {...props} className={`ui-dropdown-item ${type === "danger" ? "danger" : ""} ${className}`} type="button" role="menuitem">{icon}{children}</button>; }

/**
 * 功能说明：渲染锚定于触发区域正上方的账户菜单。
 * @param props - 菜单内容、触发按钮和展示类名。
 * @returns 支持点击外部与 Esc 关闭的下拉菜单。
 */
export function Dropdown({ render, children, contentClassName = "", className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeWithEscape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);
  return (
    <div
      className={`ui-dropdown ${className}`}
      ref={rootRef}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('[role="menuitem"]')) setOpen(false);
      }}
    >
      {open && <div className={`ui-dropdown-popup ${contentClassName}`}>{render}</div>}
      {cloneElement(children, { "aria-expanded": open, onClick: () => { children.props.onClick?.(); setOpen((current) => !current); } })}
    </div>
  );
}
Dropdown.Menu = DropdownMenu;
Dropdown.Item = DropdownItem;

type ToastTone = "success" | "error" | "info";
interface ToastMessage { id: number; tone: ToastTone; text: string }
interface ToastDisplayMessage extends ToastMessage { closing: boolean }
interface ToastTimerState { timerId: number | null; remainingMs: number; startedAt: number }
type ToastListener = (message: ToastMessage) => void;
const toastListeners = new Set<ToastListener>();
const toastDurationMs = 2800;
const toastExitDurationMs = 160;
let toastId = 0;
function publishToast(tone: ToastTone, text: string): void {
  const message = { id: ++toastId, tone, text };
  toastListeners.forEach((listener) => listener(message));
}
export const Toast = {
  success: (text: string) => publishToast("success", text),
  error: (text: string) => publishToast("error", text),
  info: (text: string) => publishToast("info", text),
};

/**
 * 功能说明：承载全局 Toast 消息，并自动移除已展示的通知。
 * @returns 固定在窗口右下角的消息列表。
 */
export function ToastViewport() {
  const [messages, setMessages] = useState<ToastDisplayMessage[]>([]);
  const timersRef = useRef(new Map<number, ToastTimerState>());
  const exitTimersRef = useRef(new Map<number, number>());

  const startDismiss = useCallback((id: number) => {
    const timerState = timersRef.current.get(id);
    if (timerState && timerState.timerId !== null) window.clearTimeout(timerState.timerId);
    timersRef.current.delete(id);
    if (exitTimersRef.current.has(id)) return;

    setMessages((current) => current.map((item) => item.id === id ? { ...item, closing: true } : item));
    const exitTimerId = window.setTimeout(() => {
      exitTimersRef.current.delete(id);
      setMessages((current) => current.filter((item) => item.id !== id));
    }, toastExitDurationMs);
    exitTimersRef.current.set(id, exitTimerId);
  }, []);

  const scheduleDismiss = useCallback((id: number, delayMs: number) => {
    const timerId = window.setTimeout(() => {
      startDismiss(id);
    }, delayMs);
    timersRef.current.set(id, { timerId, remainingMs: delayMs, startedAt: Date.now() });
  }, [startDismiss]);

  useEffect(() => {
    const listener: ToastListener = (message) => {
      setMessages((current) => [...current, { ...message, closing: false }]);
      scheduleDismiss(message.id, toastDurationMs);
    };
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
      timersRef.current.forEach(({ timerId }) => {
        if (timerId !== null) window.clearTimeout(timerId);
      });
      timersRef.current.clear();
      exitTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      exitTimersRef.current.clear();
    };
  }, [scheduleDismiss]);

  const dismiss = (id: number) => {
    startDismiss(id);
  };

  const pauseDismiss = (id: number) => {
    const timerState = timersRef.current.get(id);
    if (!timerState || timerState.timerId === null) return;
    window.clearTimeout(timerState.timerId);
    const elapsedMs = Date.now() - timerState.startedAt;
    timersRef.current.set(id, {
      timerId: null,
      remainingMs: Math.max(0, timerState.remainingMs - elapsedMs),
      startedAt: 0,
    });
  };

  const resumeDismiss = (id: number) => {
    const timerState = timersRef.current.get(id);
    if (!timerState || timerState.timerId !== null) return;
    scheduleDismiss(id, timerState.remainingMs);
  };

  return (
    <div className="ui-toast-viewport" aria-live="polite" aria-atomic="false">
      {messages.map((message) => (
        <div
          className={`ui-toast ui-toast-${message.tone} ${message.closing ? "ui-toast-closing" : ""}`}
          role={message.tone === "error" ? "alert" : "status"}
          key={message.id}
          onPointerEnter={() => pauseDismiss(message.id)}
          onPointerLeave={() => resumeDismiss(message.id)}
        >
          <span className="ui-toast-mark" aria-hidden="true" />
          <span>{message.text}</span>
          <Tooltip content="关闭提示">
            <button className="ui-toast-close" type="button" aria-label="关闭提示" onClick={() => dismiss(message.id)}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}
