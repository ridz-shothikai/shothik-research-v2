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
      logger.info("🔧 Initializing Vector Memory Service with Pinecone...");

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
      logger.info("✅ Vector Memory Service initialized successfully");
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
      logger.info(`💾 Storing research memory for chat: ${memory.chatId}`);
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

      logger.info(
        `✅ Research memory stored successfully for chat: ${memory.chatId} with ID: ${uniqueId}`
      );
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
      logger.info(`🔍 Finding similar research for query: "${query}"`);
      const keywordData =
        await this.keywordExtractor.extractPrioritizedKeywords(query);
      const keyTerms = keywordData.keywords;
      logger.info(
        `🤖 AI extracted ${keyTerms.length} keywords: ${keyTerms.join(", ")}`
      );
      logger.info(`📊 Query priority score: ${keywordData.priority}/10`);
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

      logger.info(`🔍 Running ${searchPromises.length} search strategies...`);
      const allResults = await Promise.all(searchPromises);
      const combinedResults = allResults.flat();

      logger.info(
        `📊 Combined search returned ${combinedResults.length} total results`
      );

      const seenIds = new Set<string>();
      const uniqueResults = combinedResults.filter(([doc, score]) => {
        const docId = `${doc.metadata.chatId}_${doc.metadata.timestamp}`;
        if (seenIds.has(docId)) return false;
        seenIds.add(docId);
        return true;
      });

      logger.info(
        `📊 After deduplication: ${uniqueResults.length} unique results`
      );

      const filteredResults = [];
      for (const [doc, score] of uniqueResults) {
        const isCurrentChat = doc.metadata.chatId === chatId;
        const isResearchMemory = doc.metadata.type === "research_memory";
        const isFromDifferentChat = !isCurrentChat;
        const isRecent = this.isRecentEnough(doc.metadata.timestamp);
        if (!isResearchMemory || !isFromDifferentChat || !isRecent) {
          logger.info(
            `🔍 Skipping result: "${doc.metadata.query}" (basic criteria failed)`
          );
          continue;
        }

        const hasContextualRelevance = this.isContextuallyRelevant(
          query,
          doc.metadata.query,
          score as number
        );
        if (!hasContextualRelevance) {
          logger.info(
            `🔍 Skipping result: "${doc.metadata.query}" (contextual relevance failed)`
          );
          continue;
        }
        const hasExcellentScore = score > 0.6;
        const hasGoodScore = score > 0.45;
        const hasKeywordMatch = hasGoodScore
          ? await this.hasKeywordOverlap(query, doc.metadata.query)
          : false;

        logger.info(`🔍 Evaluating result: "${doc.metadata.query}"`);
        logger.info(
          `   - Chat ID: ${doc.metadata.chatId} (current: ${chatId}, same: ${isCurrentChat})`
        );
        logger.info(
          `   - Score: ${score.toFixed(
            3
          )} (excellent: ${hasExcellentScore}, good: ${hasGoodScore})`
        );
        logger.info(`   - Keyword match: ${hasKeywordMatch}`);
        logger.info(
          `   - Type: ${doc.metadata.type} (is research: ${isResearchMemory})`
        );

        const shouldInclude =
          hasExcellentScore || (hasGoodScore && hasKeywordMatch);

        logger.info(`   - Should include: ${shouldInclude}`);

        if (shouldInclude) {
          filteredResults.push([doc, score]);
        }
      }

      logger.info(
        `📊 After filtering: ${filteredResults.length} relevant results`
      );

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

      logger.info(
        `📊 Found ${similarResearch.length} similar research results`
      );
      similarResearch.forEach((research, index) => {
        logger.info(
          `   ${index + 1}. "${
            research.query
          }" (score: ${research.similarity.toFixed(3)})`
        );
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
      logger.info(`📚 Retrieving research history for chat: ${chatId}`);
      const results = await this.vectorStore!.similaritySearch(
        `chatId:${chatId}`,
        20,
        { chatId }
      );

      if (results.length === 0) {
        logger.info(`📭 No research history found for chat: ${chatId}`);
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

      logger.info(
        `✅ Retrieved ${memories.length} research entries for chat: ${chatId}`
      );
      return memories;
    } catch (error) {
      logger.error("❌ Failed to retrieve research history:", error);
      return [];
    }
  }

  private async getCachedKeywords(query: string): Promise<string[]> {
    const cacheKey = query.toLowerCase().trim();

    if (this.keywordCache.has(cacheKey)) {
      logger.info(`🎯 Using cached keywords for: "${query}"`);
      return this.keywordCache.get(cacheKey)!;
    }

    logger.info(`🤖 AI extracting keywords from: "${query}"`);
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

      logger.info(`🔗 Keyword overlap: ${query1} <-> ${query2}`);
      logger.info(`   Keywords1: ${keywords1.join(", ")}`);
      logger.info(`   Keywords2: ${keywords2.join(", ")}`);
      logger.info(
        `   Overlap: ${overlap.toFixed(
          3
        )}, Partial: ${partialMatches}, Result: ${hasOverlap}`
      );

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
      logger.info(
        `   - Contextual relevance: false (corporate vs product comparison mismatch)`
      );
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
      logger.info(
        `   - Contextual relevance: false (general vs specific product mismatch)`
      );
      return false;
    }

    logger.info(`   - Contextual relevance: true`);
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
      logger.info(`🗑️ Deleting all research memories for chat: ${chatId}`);

      const memories = await this.getResearchHistory(chatId);

      if (memories.length === 0) {
        logger.info(
          `📭 No research memories found to delete for chat: ${chatId}`
        );
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

          logger.info(
            `✅ Successfully deleted ${vectorIds.length} research memories for chat: ${chatId}`
          );
        } catch (deleteError) {
          logger.error(`❌ Failed to delete vectors by IDs:`, deleteError);
          throw new Error(`Failed to delete research memories: ${deleteError}`);
        }
      }

      logger.info(
        `✅ Research memory deletion process completed for chat: ${chatId}`
      );
    } catch (error) {
      logger.error("❌ Failed to delete research memory:", error);
      throw error;
    }
  }
}

export default VectorMemoryService;
