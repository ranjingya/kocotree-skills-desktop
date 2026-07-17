import { Button, Modal } from "./ui";

export interface InstallFeedbackState {
  tone: "warning" | "error";
  title: string;
  summary: string;
  details: string[];
}

/**
 * 功能说明：展示安装中止、自动恢复和安装后降级处理等需要用户知晓的结果。
 * @param feedback - 当前需要展示的反馈标题、摘要、详情和语气。
 * @param onClose - 用户确认反馈后的关闭回调。
 * @returns 安装结果反馈模态框。
 */
export function InstallFeedbackModal({
  feedback,
  onClose,
}: {
  feedback: InstallFeedbackState | null;
  onClose: () => void;
}) {
  return (
    <Modal
      className="install-feedback-modal"
      title={feedback?.title ?? "安装结果"}
      visible={feedback !== null}
      width={520}
      centered
      onCancel={onClose}
      footer={<div className="install-feedback-actions"><Button theme="solid" type="primary" onClick={onClose}>知道了</Button></div>}
    >
      {feedback && (
        <div className={`install-feedback-content ${feedback.tone}`}>
          <span className="install-feedback-mark" aria-hidden="true">{feedback.tone === "error" ? "!" : "i"}</span>
          <div>
            <strong>{feedback.summary}</strong>
            <ul>
              {feedback.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
