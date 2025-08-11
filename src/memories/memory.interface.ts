export interface ResearchMemory {
  chatId: string;
  query: string;
  result: string;
  sources: string[];
  timestamp: Date;
}

export interface ISource {
  url: string;
  title: string;
  resolved_url?: string;
  reference?: number;
}

export interface SimilarResearch {
  chatId: string;
  query: string;
  result: string;
  sources: string[];
  similarity: number;
}
