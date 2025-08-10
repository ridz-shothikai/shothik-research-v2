export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
  summary?: string;
}

export interface ResearchSession {
  _id?: string;
  sessionId: string;
  query: string;
  status: "pending" | "in_progress" | "completed" | "error";
  webSearchResults: SearchResult[];
  finalAnswer?: string;
  sources?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamEvent {
  type: string;
  data?: any;
  step?: string;
  timestamp?: Date;
  error?: string;
}

export interface GeminiOptions {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
}

export interface SearchOptions {
  maxResults?: number;
}

export interface CustomError extends Error {
  status?: number;
}

export interface AgentState {
  query: string;
  webSearchResults: SearchResult[];
  finalAnswer?: string;
  sources?: string[];
  reflection?: Reflection;
}

export interface Reflection {
  is_sufficient: boolean;
  knowledge_gap: string;
  follow_up_queries: string[];
}

export interface DatabaseConfig {
  mongoUri: string;
  dbName: string;
}

export interface APIConfig {
  geminiApiKey: string;
  googleSearchApiKey?: string;
  googleSearchEngineId?: string;
}

export type StreamCallback = (event: StreamEvent) => void;
export type ErrorHandler = (error: Error) => void;
