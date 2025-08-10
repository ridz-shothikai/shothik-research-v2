import { Document } from "mongoose";

export interface ISource {
  url: string;
  title: string;
  resolved_url?: string;
  reference?: number;
}

export interface IImage {
  url: string;
  title: string;
  source: string;
  alt_text?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  context_url?: string;
  relevance_score?: number;
}

// TypeScript interface for search query objects
export interface ISearchQuery {
  query: string;
  rationale: string;
}

export interface IResearchResult extends Document {
  query: string;
  result: string;
  sources: ISource[];
  images: IImage[];
  research_loops: number;
  search_queries: ISearchQuery[];
  config?: {
    query_generator_model?: string;
    reflection_model?: string;
    answer_model?: string;
    number_of_initial_queries?: number;
    max_research_loops?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
