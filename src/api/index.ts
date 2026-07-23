import { isTauri } from "@tauri-apps/api/core";
import { MockSkillApi } from "./mockSkillApi";
import { MockLocalSkillService } from "./mockLocalSkillService";
import { TauriInstaller } from "./tauriInstaller";

export * from "./contracts";
export * from "./skillPackage";

/** 当前开发阶段共享的模拟接口实例。 */
export const skillApi = new MockSkillApi();
export const localSkillService = new MockLocalSkillService();
export const usesRealInstaller = isTauri();
/** 浏览器使用 Mock，Tauri 桌面窗口使用真实磁盘安装器。 */
export const installer = usesRealInstaller ? new TauriInstaller() : localSkillService;
