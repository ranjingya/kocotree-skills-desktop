import { Button, Modal, TextArea } from "@douyinfe/semi-ui";

/**
 * 功能说明：为归档和版本撤回收集必填原因并统一确认交互。
 * @param title - 当前管理动作标题。
 * @param description - 动作影响说明。
 * @param visible - 是否显示模态框。
 * @param reason - 当前原因文本。
 * @param loading - 提交是否进行中。
 * @param onReasonChange - 原因文本变化回调。
 * @param onCancel - 取消动作回调。
 * @param onConfirm - 确认动作回调。
 * @returns 带原因输入框的管理动作模态框。
 */
export function ReasonActionModal({
  title,
  description,
  visible,
  reason,
  loading,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  visible: boolean;
  reason: string;
  loading: boolean;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      className="reason-action-modal"
      title={title}
      visible={visible}
      width={480}
      centered
      onCancel={onCancel}
      footer={
        <div className="reason-action-footer">
          <Button disabled={loading} onClick={onCancel}>取消</Button>
          <Button theme="solid" type="danger" loading={loading} disabled={!reason.trim()} onClick={onConfirm}>确认</Button>
        </div>
      }
    >
      <div className="reason-action-content">
        <p>{description}</p>
        <label><span>原因</span><TextArea value={reason} maxCount={1000} autosize={{ minRows: 3, maxRows: 6 }} onChange={onReasonChange} placeholder="请说明执行该操作的原因" /></label>
      </div>
    </Modal>
  );
}
