import { MockSkillApi } from "./mockSkillApi";

export * from "./contracts";
export * from "./skillPackage";

/** 当前开发阶段共享的模拟接口实例。 */
export const skillApi = new MockSkillApi();
