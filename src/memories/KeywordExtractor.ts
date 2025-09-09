import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import { logger } from "../utils/logger.js";

const KeywordExtractionSchema = z.object({
  primary_keywords: z
    .array(z.string())
    .describe("Most important keywords that capture the core concepts"),
  secondary_keywords: z
    .array(z.string())
    .describe("Supporting keywords that provide context"),
  domain_terms: z
    .array(z.string())
    .describe("Domain-specific technical terms or brand names"),
  semantic_variants: z
    .array(z.string())
    .describe("Alternative terms, synonyms, or related concepts"),
  priority_score: z
    .number()
    .min(1)
    .max(10)
    .describe("Overall priority/importance score for this query"),
});

export type KeywordExtraction = z.infer<typeof KeywordExtractionSchema>;

export class AIKeywordExtractor {
  private static instance: AIKeywordExtractor;
  private model: ChatGoogleGenerativeAI;
  private parser: StructuredOutputParser<typeof KeywordExtractionSchema>;

  private constructor() {
    this.model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.5-pro",
      temperature: 0.1,
      maxOutputTokens: 65536,
    });

    this.parser = StructuredOutputParser.fromZodSchema(KeywordExtractionSchema);
  }

  public static getInstance(): AIKeywordExtractor {
    if (!AIKeywordExtractor.instance) {
      AIKeywordExtractor.instance = new AIKeywordExtractor();
    }
    return AIKeywordExtractor.instance;
  }

  public async extractKeywords(query: string): Promise<KeywordExtraction> {
    try {
      const prompt = this.buildExtractionPrompt(query);
      const response = await this.model.invoke([
        { role: "user", content: prompt },
      ]);
      const result = (await this.parser.parse(
        String(response.content)
      )) as KeywordExtraction;

      return result;
    } catch (error) {
      logger.error(
        "❌ AI keyword extraction failed, falling back to simple extraction:",
        error
      );
      return this.fallbackExtraction(query);
    }
  }

  private buildExtractionPrompt(query: string): string {
    return `You are an expert semantic analysis AI. Extract meaningful keywords from the following research query for vector similarity search.

TASK: Analyze the query and extract keywords that will help find semantically similar research.

GUIDELINES:
1. **Primary Keywords**: Core concepts, main subjects (3-5 keywords)
2. **Secondary Keywords**: Supporting context, descriptive terms (2-4 keywords)
3. **Domain Terms**: Technical terms, brand names, model numbers, specific terminology
4. **Semantic Variants**: Synonyms, alternative phrasings, related concepts
5. **Priority Score**: Rate 1-10 how specific/important this query is (10 = very specific)

EXAMPLES:
Query: "compare iPhone 16 vs Samsung Galaxy S24"
- Primary: ["iphone", "samsung", "galaxy", "comparison"]
- Secondary: ["smartphone", "mobile", "device"]
- Domain: ["iphone16", "galaxys24", "apple", "android"]
- Variants: ["phone", "cellphone", "versus", "vs"]

Query: "machine learning algorithms for image recognition"
- Primary: ["machine learning", "algorithms", "image recognition"]
- Secondary: ["computer vision", "artificial intelligence"]
- Domain: ["neural networks", "deep learning", "cnn", "classification"]
- Variants: ["ml", "ai", "pattern recognition", "computer vision"]

IMPORTANT:
- Focus on terms that would appear in similar research
- Include brand names, model numbers, technical terms
- Consider abbreviations and common alternatives
- Normalize case and remove punctuation
- Prioritize specificity over generality

Query to analyze: "${query}"

${this.parser.getFormatInstructions()}`;
  }

  private fallbackExtraction(query: string): KeywordExtraction {
    const words = query
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2);

    const uniqueWords = [...new Set(words)];

    return {
      primary_keywords: uniqueWords.slice(0, 3),
      secondary_keywords: uniqueWords.slice(3, 5),
      domain_terms: uniqueWords.filter(
        (word) => /\d/.test(word) || word.length > 6
      ),
      semantic_variants: [],
      priority_score: 5,
    };
  }

  public async extractKeywordsFlat(query: string): Promise<string[]> {
    const extraction = await this.extractKeywords(query);

    return [
      ...extraction.primary_keywords,
      ...extraction.secondary_keywords,
      ...extraction.domain_terms,
      ...extraction.semantic_variants,
    ].filter((term, index, arr) => arr.indexOf(term) === index); // Remove duplicates
  }

  public async extractPrioritizedKeywords(
    query: string
  ): Promise<{ keywords: string[]; priority: number }> {
    const extraction = await this.extractKeywords(query);

    const prioritizedKeywords = [
      ...extraction.primary_keywords,
      ...extraction.domain_terms,
      ...extraction.secondary_keywords,
      ...extraction.semantic_variants,
    ].filter((term, index, arr) => arr.indexOf(term) === index);

    return {
      keywords: prioritizedKeywords,
      priority: extraction.priority_score,
    };
  }
}
