import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";
import { AIKeywordExtractor } from "./KeywordExtractor.js";
import { ResearchMemory, SimilarResearch } from "./memory.interface.js";

dotenv.config();
export class VectorMemoryService {
  private static instance: VectorMemoryService;
  private isInitialized = false;
  private vectorStore: PineconeStore | null = null;
  private pinecone: PineconeClient;
  private keywordExtractor: AIKeywordExtractor;
  private keywordCache: Map<string, string[]> = new Map();
  private embeddings: GoogleGenerativeAIEmbeddings;

  private constructor() {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: "text-embedding-004",
    });

    this.pinecone = new PineconeClient({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    this.keywordExtractor = AIKeywordExtractor.getInstance();
  }

  public static getInstance(): VectorMemoryService {
    if (!VectorMemoryService.instance) {
      VectorMemoryService.instance = new VectorMemoryService();
    }
    return VectorMemoryService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const indexName = process.env.PINECONE_INDEX_NAME!;
      const pineconeIndex = this.pinecone.Index(indexName);

      this.vectorStore = await PineconeStore.fromExistingIndex(
        this.embeddings,
        {
          pineconeIndex: pineconeIndex as any,
          maxConcurrency: 5,
          namespace: "research_memory",
        }
      );

      this.isInitialized = true;
    } catch (error) {
      logger.error("❌ Failed to initialize Vector Memory Service:", error);
      throw error;
    }
  }

  public async storeResearchMemory(memory: ResearchMemory): Promise<void> {
    if (!this.isInitialized || !this.vectorStore) {
      await this.initialize();
    }

    try {
      const content = `Query: ${memory.query}\n\nResult: ${
        memory.result
      }\n\nSources: ${memory.sources.join(", ")}`;

      const document: Document = {
        pageContent: content,
        metadata: {
          chatId: memory.chatId,
          query: memory.query,
          timestamp: memory.timestamp.toISOString(),
          sources: memory.sources,
          type: "research_memory",
        },
      };
      const uniqueId = `research_${memory.chatId}_${Date.now()}`;
      await this.vectorStore!.addDocuments([document], {
        ids: [uniqueId],
      });
    } catch (error) {
      logger.error("❌ Failed to store research memory:", error);
      throw error;
    }
  }

  public async findSimilarResearch(
    query: string,
    chatId: string,
    limit: number = 5
  ): Promise<SimilarResearch[]> {
    if (!this.isInitialized || !this.vectorStore) {
      await this.initialize();
    }

    try {
      const keywordData =
        await this.keywordExtractor.extractPrioritizedKeywords(query);
      const keyTerms = keywordData.keywords;
      const searchPromises = [
        this.vectorStore!.similaritySearchWithScore(query, limit * 4),
        this.vectorStore!.similaritySearchWithScore(
          keyTerms.slice(0, 5).join(" "),
          limit * 3
        ),
        ...keyTerms
          .slice(0, 3)
          .map((term) =>
            this.vectorStore!.similaritySearchWithScore(term, limit * 2)
          ),
      ];
      const allResults = await Promise.all(searchPromises);
      const combinedResults = allResults.flat();
      const seenIds = new Set<string>();
      const uniqueResults = combinedResults.filter(([doc, score]) => {
        const docId = `${doc.metadata.chatId}_${doc.metadata.timestamp}`;
        if (seenIds.has(docId)) return false;
        seenIds.add(docId);
        return true;
      });

      const filteredResults = [];
      for (const [doc, score] of uniqueResults) {
        const isCurrentChat = doc.metadata.chatId === chatId;
        const isResearchMemory = doc.metadata.type === "research_memory";
        const isFromDifferentChat = !isCurrentChat;
        const isRecent = this.isRecentEnough(doc.metadata.timestamp);
        if (!isResearchMemory || !isFromDifferentChat || !isRecent) {
          continue;
        }

        const hasContextualRelevance = this.isContextuallyRelevant(
          query,
          doc.metadata.query,
          score as number
        );
        if (!hasContextualRelevance) {
          continue;
        }
        const hasExcellentScore = score > 0.6;
        const hasGoodScore = score > 0.45;
        const hasKeywordMatch = hasGoodScore
          ? await this.hasKeywordOverlap(query, doc.metadata.query)
          : false;

        const shouldInclude =
          hasExcellentScore || (hasGoodScore && hasKeywordMatch);

        if (shouldInclude) {
          filteredResults.push([doc, score]);
        }
      }

      const similarResearch: SimilarResearch[] = filteredResults
        .sort(
          ([, scoreA], [, scoreB]) => (scoreB as number) - (scoreA as number)
        )
        .slice(0, limit)
        .map(([doc, score]) => {
          const document = doc as Document;
          return {
            chatId: document.metadata.chatId,
            query: document.metadata.query,
            result:
              document.pageContent
                .split("Result: ")[1]
                ?.split("\n\nSources: ")[0] || "No result found",
            sources: document.metadata.sources || [],
            similarity: score as number,
          };
        });

      return similarResearch;
    } catch (error) {
      logger.error("❌ Failed to find similar research:", error);
      return [];
    }
  }

  public async getResearchHistory(chatId: string): Promise<ResearchMemory[]> {
    if (!this.isInitialized || !this.vectorStore) {
      await this.initialize();
    }

    try {
      const results = await this.vectorStore!.similaritySearch(
        `chatId:${chatId}`,
        20,
        { chatId }
      );

      if (results.length === 0) {
        return [];
      }

      const memories: ResearchMemory[] = results
        .filter((doc) => doc.metadata.chatId === chatId)
        .map((doc) => ({
          chatId: doc.metadata.chatId,
          query: doc.metadata.query,
          result:
            doc.pageContent.split("Result: ")[1]?.split("\n\nSources: ")[0] ||
            "",
          sources: doc.metadata.sources || [],
          timestamp: new Date(doc.metadata.timestamp),
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return memories;
    } catch (error) {
      logger.error("❌ Failed to retrieve research history:", error);
      return [];
    }
  }

  private async getCachedKeywords(query: string): Promise<string[]> {
    const cacheKey = query.toLowerCase().trim();

    if (this.keywordCache.has(cacheKey)) {
      return this.keywordCache.get(cacheKey)!;
    }
    const keywords = await this.keywordExtractor.extractKeywordsFlat(query);
    this.keywordCache.set(cacheKey, keywords);
    return keywords;
  }

  private async hasKeywordOverlap(
    query1: string,
    query2: string
  ): Promise<boolean> {
    try {
      const [keywords1, keywords2] = await Promise.all([
        this.getCachedKeywords(query1),
        this.getCachedKeywords(query2),
      ]);

      const terms1 = new Set(keywords1.map((term) => term.toLowerCase()));
      const terms2 = new Set(keywords2.map((term) => term.toLowerCase()));
      const intersection = new Set([...terms1].filter((x) => terms2.has(x)));
      const overlap = intersection.size / Math.min(terms1.size, terms2.size);

      const partialMatches = [...terms1].some((term1) =>
        [...terms2].some(
          (term2) =>
            (term1.length > 3 && term2.includes(term1)) ||
            (term2.length > 3 && term1.includes(term2))
        )
      );

      const hasOverlap = overlap > 0.25 || (overlap > 0.15 && partialMatches);
      return hasOverlap;
    } catch (error) {
      logger.error("❌ AI keyword overlap failed, using fallback:", error);
      return this.fallbackKeywordOverlap(query1, query2);
    }
  }

  private fallbackKeywordOverlap(query1: string, query2: string): boolean {
    const words1 = new Set(
      query1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
    const words2 = new Set(
      query2
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    return intersection.size > 0;
  }

  private isContextuallyRelevant(
    query1: string,
    query2: string,
    similarityScore: number
  ): boolean {
    if (similarityScore > 0.7) {
      return true;
    }
    const query1Lower = query1.toLowerCase();
    const query2Lower = query2.toLowerCase();
    const isQuery1Corporate =
      query1Lower.includes("about") ||
      query1Lower.includes("company") ||
      query1Lower.includes("corporate") ||
      query1Lower.includes("business");
    const isQuery2ProductComparison =
      query2Lower.includes("compare") ||
      query2Lower.includes("vs") ||
      query2Lower.includes("versus") ||
      query2Lower.includes("pro max") ||
      query2Lower.includes("iphone 1") ||
      query2Lower.includes("model");
    if (isQuery1Corporate && isQuery2ProductComparison) {
      return false;
    }
    const isQuery1General =
      !query1Lower.match(/\d+/) &&
      !query1Lower.includes("pro") &&
      !query1Lower.includes("max");
    const isQuery2SpecificProduct =
      query2Lower.match(/\d+/) ||
      query2Lower.includes("pro") ||
      query2Lower.includes("max");

    if (isQuery1General && isQuery2SpecificProduct && similarityScore < 0.5) {
      return false;
    }
    return true;
  }

  private isRecentEnough(timestamp: string | Date): boolean {
    const researchDate = new Date(timestamp);
    const now = new Date();
    const daysDiff =
      (now.getTime() - researchDate.getTime()) / (1000 * 60 * 60 * 24);

    return daysDiff <= 30;
  }

  public async deleteResearchMemory(chatId: string): Promise<void> {
    if (!this.isInitialized || !this.vectorStore) {
      await this.initialize();
    }

    try {

      const memories = await this.getResearchHistory(chatId);

      if (memories.length === 0) {
        return;
      }
      const vectorIds = memories.map(
        (memory) => `research_${memory.chatId}_${memory.timestamp.getTime()}`
      );

      if (vectorIds.length > 0) {
        const pineconeIndex = this.pinecone.Index(
          process.env.PINECONE_INDEX_NAME!
        );

        try {
          const namespacedIndex = pineconeIndex.namespace("research_memory");
          await namespacedIndex.deleteMany(vectorIds);
        } catch (deleteError) {
          logger.error(`❌ Failed to delete vectors by IDs:`, deleteError);
          throw new Error(`Failed to delete research memories: ${deleteError}`);
        }
      }
    } catch (error) {
      logger.error("❌ Failed to delete research memory:", error);
      throw error;
    }
  }
}

export default VectorMemoryService;
