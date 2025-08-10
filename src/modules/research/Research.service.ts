import { IResearchResult } from "./Research.interface.js";
import ResearchResultModel from "./Research.model.js";
import { researchSchema } from "./Research.validation.js";
import Configuration from "./tools/configuration.js";
import { graph } from "./tools/graph.js";
import { OverallState } from "./tools/state.js";

class ResearchService {
  static async CreateWithStreaming(
    body: Partial<IResearchResult>,
    streamCallback: (step: string, data: any, conversation: string) => void
  ): Promise<IResearchResult> {
    try {
      const result = await researchSchema.validateAsync(body);
      const initialState = new OverallState();
      initialState.addMessages([{ role: "user", content: result?.query }]);

      const configuration = new Configuration(result?.config);
      const runnableConfig = {
        configurable: configuration.toObject(),
      };

      console.log(`🚀 Starting research for query: "${result?.query}"`);

      const graphResult = await graph.invoke(initialState, runnableConfig);

      const researchResult = new ResearchResultModel({
        query: result?.query,
        result: graphResult.running_summary,
        sources: graphResult.sources_gathered,
        images: graphResult.images || [],
        research_loops: graphResult.research_loop_count,
        search_queries: graphResult.search_query,
        config: result?.config,
      });

      const savedResult = await researchResult.save();
      return savedResult;
    } catch (error: any) {
      console.error("Conversation processing failed:", error);
      throw error;
    }
  }
}

export default ResearchService;
