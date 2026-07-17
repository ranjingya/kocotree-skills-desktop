import { useCallback, useEffect, useState } from "react";
import { Button, Spin } from "@douyinfe/semi-ui";
import { skillApi, type NotificationDto } from "../api";

/**
 * 功能说明：展示轻量站内通知并支持单条和全部标记已读。
 * @param onUnreadChange - 未读数量变化后的回调。
 * @param onOpenSkill - 点击关联通知时打开 Skill 的回调。
 * @returns 账户气泡中的通知列表。
 */
export function NotificationPanel({
  onUnreadChange,
  onOpenSkill,
}: {
  onUnreadChange: (count: number) => void;
  onOpenSkill: (skillId: string) => void;
}) {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await skillApi.listNotifications({ pageSize: 10 });
      setItems(result.items);
      onUnreadChange(result.unreadCount);
    } catch (reason) {
      console.error("[KocotreeSkills] 通知加载失败", reason);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  async function handleRead(item: NotificationDto): Promise<void> {
    if (!item.readAt) await skillApi.readNotification(item.id);
    await loadNotifications();
    if (item.skillId) onOpenSkill(item.skillId);
  }

  async function handleReadAll(): Promise<void> {
    await skillApi.readAllNotifications();
    await loadNotifications();
  }

  return (
    <section className="notification-panel">
      <header><strong>通知</strong><Button size="small" theme="borderless" onClick={() => void handleReadAll()}>全部已读</Button></header>
      {loading ? (
        <div className="notification-state"><Spin size="small" />正在加载</div>
      ) : items.length === 0 ? (
        <div className="notification-state">暂时没有通知</div>
      ) : (
        <div className="notification-list">
          {items.map((item) => (
            <button className={item.readAt ? "notification-item" : "notification-item unread"} type="button" key={item.id} onClick={() => void handleRead(item)}>
              <span className="notification-dot" />
              <span><strong>{item.title}</strong><small>{item.body}</small></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
