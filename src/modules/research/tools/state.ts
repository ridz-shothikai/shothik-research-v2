import { ImageResult, Message } from "../Research.interface.js";

class OverallState {
  public messages: Message[];
  public search_query: string[];
  public web_research_result: any[];
  public sources_gathered: string[];
  public images: ImageResult[];
  public initial_search_query_count: number;
  public max_research_loops: number;
  public research_loop_count: number;
  public reasoning_model: string;
  public running_summary?: string;
  public similar_research_context?: string;
  public existing_research_history?: string;

  constructor() {
    this.messages = [];
    this.search_query = [];
    this.web_research_result = [];
    this.sources_gathered = [];
    this.images = [];
    this.initial_search_query_count = 0;
    this.max_research_loops = 3;
    this.research_loop_count = 0;
    this.reasoning_model = "gemini-2.5-pro";
  }

  addMessages(newMessages: Message | Message[]): void {
    if (Array.isArray(newMessages)) {
      this.messages.push(...newMessages);
    } else {
      this.messages.push(newMessages);
    }
  }

  addSearchQueries(newQueries: string | string[]): void {
    if (Array.isArray(newQueries)) {
      this.search_query.push(...newQueries);
    } else {
      this.search_query.push(newQueries);
    }
  }

  addWebResearchResults(newResults: any | any[]): void {
    if (Array.isArray(newResults)) {
      this.web_research_result.push(...newResults);
    } else {
      this.web_research_result.push(newResults);
    }
  }

  addSources(newSources: string | string[]): void {
    if (Array.isArray(newSources)) {
      this.sources_gathered.push(...newSources);
    } else {
      this.sources_gathered.push(newSources);
    }
  }

  addImages(newImages: ImageResult | ImageResult[]): void {
    if (Array.isArray(newImages)) {
      this.images.push(...newImages);
    } else {
      this.images.push(newImages);
    }
  }
}

class ReflectionState {
  public is_sufficient: boolean;
  public knowledge_gap: string;
  public follow_up_queries: string[];
  public research_loop_count: number;
  public number_of_ran_queries: number;

  constructor() {
    this.is_sufficient = false;
    this.knowledge_gap = "";
    this.follow_up_queries = [];
    this.research_loop_count = 0;
    this.number_of_ran_queries = 0;
  }

  addFollowUpQueries(newQueries: string | string[]): void {
    if (Array.isArray(newQueries)) {
      this.follow_up_queries.push(...newQueries);
    } else {
      this.follow_up_queries.push(newQueries);
    }
  }
}

class Query {
  public query: string;
  public rationale: string;

  constructor(query: string, rationale: string) {
    this.query = query;
    this.rationale = rationale;
  }
}

class QueryGenerationState {
  public search_query: string[];

  constructor() {
    this.search_query = [];
  }
}

class WebSearchState {
  public search_query: string;
  public id: string;

  constructor(search_query: string, id: string) {
    this.search_query = search_query;
    this.id = id;
  }
}

class SearchStateOutput {
  public running_summary: string | null;

  constructor(running_summary: string | null = null) {
    this.running_summary = running_summary;
  }
}

export {
  ImageResult,
  Message,
  OverallState,
  Query,
  QueryGenerationState,
  ReflectionState,
  SearchStateOutput,
  WebSearchState,
};
