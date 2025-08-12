import Configuration from "../../config/configuration.js";
import { VectorMemoryService } from "../../memories/VectorMemoryService.js";
import {
  ResearchMemory,
  SimilarResearch,
} from "../../memories/memory.interface.js";
import { sourcesToStringArray } from "../../memories/utils.js";
import { logger } from "../../utils/logger.js";
import { IResearchResult } from "./Research.interface.js";
import ResearchResultModel from "./Research.model.js";
import { researchSchema } from "./Research.validation.js";
import { graph } from "./tools/graph.js";
import { OverallState } from "./tools/state.js";

class ResearchService {
  static async CreateWithStreaming(
    body: Partial<IResearchResult>,
    streamCallback: (step: string, data: any, research: string) => void
  ): Promise<IResearchResult> {
    try {
      const result = await researchSchema.validateAsync(body);
      const vectorMemory = VectorMemoryService.getInstance();
      let existingMemories: ResearchMemory[] = [];
      let similarResearch: SimilarResearch[] = [];

      if (result?.chat) {
        try {
          logger.info(`🧠 Checking vector memory for chat: ${result.chat}`);
          existingMemories = await vectorMemory.getResearchHistory(result.chat);
          similarResearch = await vectorMemory.findSimilarResearch(
            result.query,
            result.chat,
            5
          );

          if (existingMemories.length > 0) {
            logger.info(
              `📚 Found ${existingMemories.length} existing research entries for chat: ${result.chat}`
            );
          }

          if (similarResearch.length > 0) {
            logger.info(
              `🔍 Found ${similarResearch.length} similar research results`
            );
            similarResearch.forEach((similar, index) => {
              logger.info(
                `   ${index + 1}. Similar query: "${
                  similar.query
                }" (similarity: ${similar.similarity.toFixed(3)})`
              );
            });
          }
        } catch (vectorError) {
          logger.error(
            "⚠️ Vector memory operation failed, continuing without memory:",
            vectorError
          );
        }
      }

      const initialState = new OverallState();
      initialState.addMessages([{ role: "user", content: result?.query }]);

      if (existingMemories.length > 0 || similarResearch.length > 0) {
        let contextMessage = "Research Context:\n\n";

        if (existingMemories.length > 0) {
          contextMessage += `Previous Research History for this conversation (${existingMemories.length} entries):\n`;
          existingMemories.slice(0, 3).forEach((memory, index) => {
            contextMessage += `${index + 1}. Previous Query: "${
              memory.query
            }"\n`;
            contextMessage += `   Result Summary: ${memory.result.substring(
              0,
              200
            )}${memory.result.length > 200 ? "..." : ""}\n`;
            contextMessage += `   Sources: ${memory.sources
              .slice(0, 2)
              .join(", ")}${
              memory.sources.length > 2 ? " and others" : ""
            }\n\n`;
          });

          if (existingMemories.length > 3) {
            contextMessage += `... and ${
              existingMemories.length - 3
            } more previous research entries\n\n`;
          }

          const existingContext = existingMemories
            .slice(0, 2)
            .map(
              (memory) =>
                `"${memory.query}": ${memory.result.substring(0, 150)}`
            )
            .join("; ");
          initialState.existing_research_history = `Previous research: ${existingContext}`;
        }

        if (similarResearch.length > 0) {
          contextMessage += `Similar Research from Other Conversations:\n`;
          similarResearch.forEach((similar, index) => {
            contextMessage += `${index + 1}. Query: "${
              similar.query
            }" (similarity: ${similar.similarity.toFixed(3)})\n`;
            contextMessage += `   Result: ${similar.result.substring(0, 200)}${
              similar.result.length > 200 ? "..." : ""
            }\n`;
            contextMessage += `   Key Sources: ${similar.sources
              .slice(0, 2)
              .join(", ")}\n\n`;
          });

          const similarContext = similarResearch
            .map(
              (similar) =>
                `"${similar.query}": ${similar.result.substring(0, 150)}`
            )
            .join("; ");
          initialState.similar_research_context = `Similar research: ${similarContext}`;
        }

        initialState.addMessages([
          {
            role: "system",
            content: `${contextMessage}Please use this context to enhance your research and avoid duplicating previous work. Build upon existing knowledge where relevant.`,
          },
        ]);

        logger.info(
          "🧠 Enhanced research context with similar research and history"
        );
      }

      const configuration = new Configuration(result?.config);
      const runnableConfig = {
        configurable: configuration.toObject(),
      };

      console.log(`🚀 Starting research for query: "${result?.query}"`);

      const graphResult = await graph.invoke(initialState, runnableConfig);

      const researchResult = new ResearchResultModel({
        chat: result?.chat,
        query: result?.query,
        result: graphResult.running_summary,
        sources: graphResult.sources_gathered,
        images: graphResult.images || [],
        research_loops: graphResult.research_loop_count,
        search_queries: graphResult.search_query,
        config: result?.config,
      });

      const savedResult = await researchResult.save();

      if (result?.chat && savedResult.result) {
        try {
          const researchMemory: ResearchMemory = {
            chatId: result.chat,
            query: savedResult.query,
            result: savedResult.result,
            sources: sourcesToStringArray(savedResult.sources || []),
            timestamp: new Date(),
          };

          logger.info(
            `💾 Storing new research memory for chat: ${result.chat}`
          );
          await vectorMemory.storeResearchMemory(researchMemory);
        } catch (vectorError) {
          logger.error(
            "⚠️ Failed to store research memory, but research completed successfully:",
            vectorError
          );
        }
      }

      return savedResult;
    } catch (error: any) {
      console.error("Conversation processing failed:", error);
      throw error;
    }
  }

  static async getResearchHistory(chatId: string): Promise<ResearchMemory[]> {
    try {
      const vectorMemory = VectorMemoryService.getInstance();
      return await vectorMemory.getResearchHistory(chatId);
    } catch (error) {
      logger.error("Failed to get research history:", error);
      return [];
    }
  }

  static async findSimilarResearch(
    query: string,
    excludeChatId?: string,
    limit: number = 5
  ): Promise<SimilarResearch[]> {
    try {
      const vectorMemory = VectorMemoryService.getInstance();
      return await vectorMemory.findSimilarResearch(
        query,
        excludeChatId || "",
        limit
      );
    } catch (error) {
      logger.error("Failed to find similar research:", error);
      return [];
    }
  }
}

export default ResearchService;
