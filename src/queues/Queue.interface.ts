import { IResearchResult } from "../modules/research/Research.interface.js";

export interface ResearchJobData {
  body: Partial<IResearchResult>;
  connectionId: string;
  userId?: string;
}

export interface VectorMemoryJobData {
  type: "store" | "find-similar" | "get-history";
  data: any;
  researchId?: string;
}
