import { useEffect, useState } from "react";
import { Button, Modal, Select, TextArea, Toast } from "./ui";
import { skillApi, SkillApiError, type SkillDetailDto } from "../api";

/**
 * 功能说明：向现有有效协作者发起七天有效的所有权转移邀请。
 * @param skill - 当前准备转移所有权的 Skill。
 * @param visible - 是否显示邀请模态框。
 * @param onCancel - 取消邀请回调。
 * @param onCreated - 邀请创建成功回调。
 * @returns 所有权转移邀请模态框。
 */
export function OwnershipTransferModal({
  skill,
  visible,
  onCancel,
  onCreated,
}: {
  skill: SkillDetailDto | null;
  visible: boolean;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTargetUserId("");
    setReason("");
  }, [visible]);

  async function submit(): Promise<void> {
    if (!skill || !targetUserId) return;
    setLoading(true);
    try {
      await skillApi.createOwnershipTransfer(skill.id, { targetUserId, reason: reason.trim() || null });
      Toast.success("所有权转移邀请已发送，有效期为 7 天");
      onCreated();
    } catch (error) {
      console.error("[KocotreeSkills] 所有权转移邀请创建失败", error);
      Toast.error(error instanceof SkillApiError ? error.message : "邀请发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  const activeCollaborators = skill?.collaborators.filter((user) => user.status === "ACTIVE") ?? [];

  return (
    <Modal
      className="ownership-modal"
      title="转移所有权"
      visible={visible}
      width={500}
      centered
      onCancel={onCancel}
      footer={<div className="ownership-actions"><Button disabled={loading} onClick={onCancel}>取消</Button><Button theme="solid" type="primary" loading={loading} disabled={!targetUserId} onClick={() => void submit()}>发送邀请</Button></div>}
    >
      <div className="ownership-form">
        <p>只能转移给现有的有效协作者。对方接受后会成为 Owner，你将保留为协作者。</p>
        <label><span>目标协作者</span><Select value={targetUserId || undefined} placeholder="选择协作者" optionList={activeCollaborators.map((user) => ({ value: user.id, label: `${user.name} · ${user.departmentPath.join(" / ")}` }))} onChange={(value) => setTargetUserId(String(value))} /></label>
        <label><span>说明（选填）</span><TextArea value={reason} maxCount={1000} autosize={{ minRows: 3, maxRows: 5 }} onChange={setReason} /></label>
        {activeCollaborators.length === 0 && <div className="form-error">当前没有可以接收所有权的有效协作者</div>}
      </div>
    </Modal>
  );
}
