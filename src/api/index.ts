import { MockSkillApi } from "./mockSkillApi";
import { MockLocalSkillService } from "./mockLocalSkillService";

export * from "./contracts";
export * from "./skillPackage";

/** 当前开发阶段共享的模拟接口实例。 */
export const skillApi = new MockSkillApi();
export const localSkillService = new MockLocalSkillService();
