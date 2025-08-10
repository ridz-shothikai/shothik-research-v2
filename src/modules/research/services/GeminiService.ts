import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiOptions } from "../../../types/index.js";

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  }

  async generateContent(
    prompt: string,
    options: GeminiOptions = {}
  ): Promise<string> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topK: options.topK || 40,
          topP: options.topP || 0.95,
          maxOutputTokens: options.maxOutputTokens || 65536,
        },
      });

      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error("Gemini API error:", error);
      throw new Error(`Failed to generate content: ${error.message}`);
    }
  }

  async generateStructuredContent(
    prompt: string,
    schema: any,
    options: GeminiOptions = {}
  ): Promise<any> {
    const structuredPrompt = `${prompt}

Please respond with valid JSON that matches this schema:
${JSON.stringify(schema, null, 2)}

Ensure your response is valid JSON and follows the schema exactly.`;

    try {
      const response = await this.generateContent(structuredPrompt, options);
      return JSON.parse(response);
    } catch (error: any) {
      console.error("Structured content generation error:", error);
      throw new Error(
        `Failed to generate structured content: ${error.message}`
      );
    }
  }

  async generateContentStream(
    prompt: string,
    onChunk?: (chunk: string) => void,
    options: GeminiOptions = {}
  ): Promise<string> {
    try {
      const result = await this.model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topK: options.topK || 40,
          topP: options.topP || 0.95,
          maxOutputTokens: options.maxOutputTokens || 65536,
        },
      });

      let fullText = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        if (onChunk) {
          onChunk(chunkText);
        }
      }

      return fullText;
    } catch (error: any) {
      console.error("Gemini streaming error:", error);
      throw new Error(`Failed to generate streaming content: ${error.message}`);
    }
  }

  async countTokens(text: string): Promise<number> {
    try {
      const result = await this.model.countTokens(text);
      return result.totalTokens;
    } catch (error: any) {
      console.error("Token counting error:", error);
      return Math.ceil(text.length / 4);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.generateContent(
        'Hello, respond with "OK" if you can hear me.'
      );
      return response.toLowerCase().includes("ok");
    } catch (error: any) {
      console.error("Gemini health check failed:", error);
      return false;
    }
  }
}

export default new GeminiService();
