/** Skill 列表中的一条技能记录。 */
export interface SkillRecord {
  id: string;
  slug: string;
  name: string;
  shortCode: string;
  logoTone: "dark" | "blue" | "orange" | "violet" | "green";
  description: string;
  summary: string;
  category: string;
  tags: string[];
  version: string;
  author: string;
  updatedAt: string;
  downloads: number;
  installed: boolean;
}
