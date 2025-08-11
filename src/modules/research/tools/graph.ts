import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";

import Configuration from "../../../config/configuration.js";
import { ImageSearchService } from "./imageSearch.js";
import {
  answerInstructions,
  getCurrentDate,
  queryWriterInstructions,
  reflectionInstructions,
  webSearcherInstructions,
} from "./prompts.js";
import { OverallState, Query } from "./state.js";
import { Reflection } from "./tools_and_schemas.js";
import {
  extractSourcesFromContent,
  getCitations,
  getResearchTopic,
  insertCitationMarkers,
  resolveUrls,
} from "./utils.js";

import "dotenv/config";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

async function generateQuery(state: any, config: any) {
  console.log("🔍 Generating search queries...");

  const configuration = Configuration.fromRunnableConfig(config);

  const querySchema = z.object({
    rationale: z
      .string()
      .describe("Brief explanation of why these queries are relevant"),
    query: z.array(z.string()).describe("A list of search queries"),
  });

  const parser = StructuredOutputParser.fromZodSchema(querySchema);

  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: configuration.query_generator_model,
    temperature: 0.7,
    maxOutputTokens: 65536,
  });

  const userQuestion = state.messages[state.messages.length - 1]?.content || "";

  let contextualPrompt = userQuestion;

  if (state.existing_research_history || state.similar_research_context) {
    contextualPrompt += "\n\nIMPORTANT CONTEXT:\n";

    if (state.existing_research_history) {
      contextualPrompt += `Previous research in this conversation: ${state.existing_research_history}\n`;
    }

    if (state.similar_research_context) {
      contextualPrompt += `Similar research from other conversations: ${state.similar_research_context}\n`;
    }

    contextualPrompt +=
      "\nPlease use this context to focus your search queries and avoid duplicating previous research. Build upon existing knowledge where relevant.";
  }

  const prompt =
    queryWriterInstructions(
      contextualPrompt,
      getCurrentDate(),
      configuration.number_of_initial_queries
    ) +
    "\n\n" +
    parser.getFormatInstructions();

  try {
    const response = await model.invoke([{ role: "user", content: prompt }]);

    const queryResult = await parser.parse(String(response.content));

    const queries = queryResult.query.map(
      (q) => new Query(q, queryResult.rationale)
    );

    state.addSearchQueries(queries);
    state.initial_search_query_count = queries.length;

    console.log(`✅ Generated ${queries.length} search queries`);

    return {
      search_query: queries,
    };
  } catch (error) {
    console.error("❌ Error generating queries:", error);
    try {
      const response = await model.invoke([
        {
          role: "user",
          content: queryWriterInstructions(userQuestion, getCurrentDate()),
        },
      ]);
      const queries = parseQueryResponse(response.content);
      state.addSearchQueries(queries);
      state.initial_search_query_count = queries.length;
      return { search_query: queries };
    } catch (fallbackError) {
      console.error("❌ Fallback parsing also failed:", fallbackError);
      const fallbackQuery = new Query(
        userQuestion,
        "Fallback query from user input"
      );
      state.addSearchQueries([fallbackQuery]);
      state.initial_search_query_count = 1;
      return { search_query: [fallbackQuery] };
    }
  }
}

function continueToWebResearch(state: any) {
  console.log("🚀 Continuing to web research...");
  return "web_research";
}

async function webResearch(state: any, config: any) {
  console.log(`🌐 Performing web research for queries...`);

  const configuration = Configuration.fromRunnableConfig(config);
  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: configuration.query_generator_model,
    temperature: 0.2,
    maxOutputTokens: 65536,
  });

  const allResults = [];
  const allSources = [];

  try {
    for (const queryObj of state.search_query) {
      const query = queryObj.query || queryObj;
      console.log(`🔍 Researching: ${query}`);
      const prompt = webSearcherInstructions(query, getCurrentDate());
      const response = await model.invoke([{ role: "user", content: prompt }], {
        tools: [{ googleSearch: {} }],
      });

      console.log(
        "🔍 Debug - Response structure:",
        JSON.stringify(
          {
            hasGroundingMetadata:
              !!response.response_metadata?.groundingMetadata,
            hasOldGroundingMetadata: !!(response as any).grounding_metadata,
            groundingChunks:
              response.response_metadata?.groundingMetadata?.groundingChunks
                ?.length || 0,
            responseKeys: Object.keys(response),
            responseMetadataKeys: Object.keys(response.response_metadata || {}),
            contentLength: response.content?.length || 0,
          },
          null,
          2
        )
      );

      const groundingMetadata =
        response.response_metadata?.groundingMetadata || {};
      const groundingChunks = groundingMetadata.groundingChunks || [];
      let sourcesGathered = [];
      if (groundingChunks.length === 0) {
        console.log(
          "⚠️  No grounding metadata found, attempting to extract sources from content"
        );
        sourcesGathered = extractSourcesFromContent(
          String(response.content),
          []
        );
        console.log(
          `🔍 Extracted ${sourcesGathered.length} sources from content:`,
          sourcesGathered.map((s) => s.title)
        );
      } else {
        console.log(
          `✅ Found ${groundingChunks.length} grounding chunks with real URLs`
        );
        const resolvedUrls = resolveUrls(
          groundingChunks,
          `query_${allResults.length}`
        );
        const citations = getCitations(response, resolvedUrls);

        sourcesGathered = [];
        for (const citation of citations) {
          if (citation.segments) {
            sourcesGathered.push(...citation.segments);
          } else if (citation.source) {
            sourcesGathered.push(citation.source);
          }
        }

        console.log(
          `🔍 Extracted ${sourcesGathered.length} real sources from grounding metadata:`,
          sourcesGathered.map((s) => `${s.title} -> ${s.url}`)
        );
      }

      const modifiedText = response.content;

      allResults.push(modifiedText);
      allSources.push(...sourcesGathered);

      console.log(`✅ Completed research for: ${query}`);
    }

    return {
      sources_gathered: allSources,
      web_research_result: allResults,
      research_loop_count: (state.research_loop_count || 0) + 1,
    };
  } catch (error) {
    console.error("❌ Error in web research:", error);
    throw error;
  }
}

async function reflection(state: any, config: any) {
  console.log("🤔 Performing reflection on research...");

  const configuration = Configuration.fromRunnableConfig(config);

  const reflectionSchema = z.object({
    is_sufficient: z
      .boolean()
      .describe(
        "Whether the provided summaries are sufficient to answer the user's question"
      ),
    knowledge_gap: z
      .string()
      .describe(
        "A description of what information is missing or needs clarification"
      ),
    follow_up_queries: z
      .array(z.string())
      .describe("A list of follow-up queries to address the knowledge gap"),
  });

  const parser = StructuredOutputParser.fromZodSchema(reflectionSchema);

  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: configuration.reflection_model,
    temperature: 0,
    maxOutputTokens: 65536,
  });

  const researchTopic = getResearchTopic(state.messages);
  const summaries = state.web_research_result.map((r: any) => r).join("\n\n");

  const prompt =
    reflectionInstructions(researchTopic, summaries) +
    "\n\n" +
    parser.getFormatInstructions();

  try {
    const response = await model.invoke([{ role: "user", content: prompt }]);

    const reflectionResult = await parser.parse(String(response.content));

    console.log(
      `✅ Reflection complete. Sufficient: ${reflectionResult.is_sufficient}`
    );

    return {
      search_query: reflectionResult.follow_up_queries.map(
        (q) => new Query(q, "Follow-up research")
      ),
    };
  } catch (error) {
    console.error("❌ Error in reflection:", error);
    try {
      const response = await model.invoke([
        {
          role: "user",
          content: reflectionInstructions(researchTopic, summaries),
        },
      ]);
      const fallbackResult = parseReflectionResponse(response.content);
      return {
        search_query: fallbackResult.follow_up_queries.map(
          (q) => new Query(q, "Follow-up research")
        ),
      };
    } catch (fallbackError) {
      console.error("❌ Fallback parsing also failed:", fallbackError);
      return {
        search_query: [],
      };
    }
  }
}

function evaluateResearch(state: any, config: any) {
  console.log("📊 Evaluating research progress...");

  const configuration = Configuration.fromRunnableConfig(config);
  const maxLoops = configuration.max_research_loops;
  const currentLoop = state.research_loop_count || 0;

  console.log(`Research loop: ${currentLoop}/${maxLoops}`);

  if (currentLoop >= maxLoops) {
    console.log("🏁 Maximum research loops reached, finalizing...");
    return "finalize_answer";
  }

  const lastReflection = getLastReflection(state);
  if (lastReflection && (lastReflection as any).is_sufficient) {
    console.log("✅ Research deemed sufficient, finalizing...");
    return "finalize_answer";
  }

  console.log("🔄 Continuing research...");
  return "web_research";
}

async function finalizeAnswer(state: any, config: any) {
  console.log("📝 Finalizing research answer...");

  const configuration = Configuration.fromRunnableConfig(config);
  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: configuration.answer_model,
    temperature: 0.3,
    maxOutputTokens: 65536,
  });

  console.log(
    `🔍 Debug - Sources in state:`,
    state.sources_gathered?.length || 0
  );
  const uniqueSources = deduplicateSources(state.sources_gathered);
  console.log(
    `🔍 Debug - Unique sources after deduplication:`,
    uniqueSources?.length || 0
  );
  const formattedSources = formatSources(uniqueSources);

  const allSummaries = state.web_research_result
    .map((r: any) => r.summary)
    .join("\n\n");
  const originalQuestion = state.messages[0]?.content || "";

  const prompt = answerInstructions(
    originalQuestion,
    allSummaries,
    formattedSources
  );

  try {
    const response = await model.invoke([{ role: "user", content: prompt }]);

    let extractedSources: any[] = [];
    const existingSourceCount = (uniqueSources || []).length;

    if (existingSourceCount < 3) {
      extractedSources = extractSourcesFromContent(
        String(response.content),
        uniqueSources || []
      );
      console.log(
        `🔍 Debug - Extracted ${extractedSources.length} fallback sources from final answer:`,
        extractedSources.map((s) => s.title)
      );
    } else {
      console.log(
        `🔍 Debug - Skipping content extraction, already have ${existingSourceCount} grounding metadata sources`
      );
    }

    const allSources = [...(uniqueSources || []), ...extractedSources];
    const finalUniqueSources = deduplicateSources(allSources);

    const finalAnswer = insertCitationMarkers(
      String(response.content),
      finalUniqueSources
    );

    console.log("✅ Research finalized successfully");
    console.log(`🔍 Debug - Final sources count: ${finalUniqueSources.length}`);

    const sourcesWithReferences = finalUniqueSources.map(
      (source: any, index: number) => ({
        ...source,
        reference: index + 1,
      })
    );

    return {
      running_summary: finalAnswer,
      sources_gathered: sourcesWithReferences,
    };
  } catch (error) {
    console.error("❌ Error finalizing answer:", error);
    throw error;
  }
}

async function imageSearch(state: any, config: any) {
  console.log("🖼️  Performing image search...");

  try {
    const imageSearchService = new ImageSearchService();
    const researchTopic = getResearchTopic(state.messages);

    const images = await imageSearchService.searchImages(researchTopic, 5);

    const relevantImages = imageSearchService.filterByRelevance(images, 0.3);
    const bestImages = imageSearchService.getBestImages(relevantImages, 3);

    console.log(`✅ Found ${bestImages.length} relevant images for research`);

    return {
      images: bestImages,
    };
  } catch (error) {
    console.error("❌ Error in image search:", error);
    return {
      images: [],
    };
  }
}

class ResearchAgentGraph {
  nodes: Map<string, any>;
  edges: Map<string, string[]>;
  conditionalEdges: Map<string, { condition: any; targets: any }>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.conditionalEdges = new Map();

    this.setupGraph();
  }

  setupGraph() {
    this.addNode("generate_query", generateQuery);
    this.addNode("web_research", webResearch);
    this.addNode("image_search", imageSearch);
    this.addNode("reflection", reflection);
    this.addNode("finalize_answer", finalizeAnswer);

    this.addEdge("START", "generate_query");

    this.addConditionalEdge("generate_query", continueToWebResearch, [
      "web_research",
    ]);

    this.addEdge("web_research", "image_search");

    this.addEdge("image_search", "reflection");

    this.addConditionalEdge("reflection", evaluateResearch, [
      "web_research",
      "finalize_answer",
    ]);

    this.addEdge("finalize_answer", "END");
  }

  addNode(name: string, func: any) {
    this.nodes.set(name, func);
  }

  addEdge(from: string, to: string) {
    if (!this.edges.has(from)) {
      this.edges.set(from, []);
    }
    this.edges.get(from)?.push(to);
  }

  addConditionalEdge(from: string, condition: any, targets: any) {
    this.conditionalEdges.set(from, { condition, targets });
  }

  async invoke(initialState: any, config: any = {}) {
    console.log("🚀 Starting research agent graph execution...");

    let currentState = new OverallState();
    Object.assign(currentState, initialState);

    let currentNode = "generate_query";
    const executionPath = [];

    while (currentNode !== "END") {
      console.log(`📍 Executing node: ${currentNode}`);
      executionPath.push(currentNode);

      try {
        const nodeFunction = this.nodes.get(currentNode);
        if (!nodeFunction) {
          throw new Error(`Node ${currentNode} not found`);
        }

        const result = await nodeFunction(currentState, config);

        if (result) {
          Object.assign(currentState, result);
        }
        currentNode = this.getNextNode(currentNode, currentState, config);
      } catch (error) {
        console.error(`❌ Error executing node ${currentNode}:`, error);
        throw error;
      }
    }

    console.log("✅ Graph execution completed");
    console.log("📋 Execution path:", executionPath.join(" → "));

    return currentState;
  }

  getNextNode(currentNode: string, state: any, config: any) {
    if (this.conditionalEdges.has(currentNode)) {
      const conditionalEdge = this.conditionalEdges.get(currentNode);
      if (!conditionalEdge) return null;
      const { condition, targets } = conditionalEdge;
      const result = condition(state, config);

      if (Array.isArray(result)) {
        return result[0];
      } else if (typeof result === "string") {
        return result;
      }
    }

    if (this.edges.has(currentNode)) {
      const targets = this.edges.get(currentNode);
      return targets && targets[0] ? targets[0] : null;
    }

    return "END";
  }
}

function parseQueryResponse(response: any) {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((q) => new Query(q.query, q.rationale));
      }
    }
    throw new Error("No valid query array found");
  } catch (error) {
    console.error("Error parsing query response:", error);
    return [new Query(response.substring(0, 100), "Generated from response")];
  }
}

function parseReflectionResponse(response: any) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Reflection.fromObject(parsed);
    }
    throw new Error("No valid reflection JSON found");
  } catch (error) {
    console.error("Error parsing reflection response:", error);
    return new Reflection(false, "Unable to parse reflection", []);
  }
}

function getLastReflection(state: any) {
  return null;
}

function deduplicateSources(sources: any[]) {
  const seen = new Set();
  return sources.filter((source: any) => {
    if (seen.has(source.url)) {
      return false;
    }
    seen.add(source.url);
    return true;
  });
}

function formatSources(sources: any[]) {
  return sources
    .map(
      (source: any, index: number) =>
        `[${index + 1}] ${source.title} - ${source.url}`
    )
    .join("\n");
}

const graph = new ResearchAgentGraph();

export {
  evaluateResearch,
  finalizeAnswer,
  generateQuery,
  graph,
  reflection,
  ResearchAgentGraph,
  webResearch,
};
