import "dotenv/config";
import { google } from "googleapis";

interface ImageResult {
  url: string;
  title: string;
  source: string;
  alt_text: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  context_url?: string;
  relevance_score: number;
}

class ImageSearchService {
  private customSearch: any;
  private apiKey: string | undefined;
  private searchEngineId: string | undefined;

  constructor() {
    this.customSearch = google.customsearch("v1");
    this.apiKey = process.env.GEMINI_API_KEY;
    this.searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  }

  async searchImages(
    query: string,
    numImages: number = 5
  ): Promise<ImageResult[]> {
    try {
      if (!this.apiKey) {
        console.log("⚠️  Google API key not found, skipping image search");
        return [];
      }

      if (!this.searchEngineId) {
        console.log(
          "⚠️  Google Custom Search Engine ID not found, skipping image search"
        );
        return [];
      }

      console.log(
        `🖼️  Searching for ${numImages} images for query: "${query}"`
      );

      const response = await this.customSearch.cse.list({
        auth: this.apiKey,
        cx: this.searchEngineId,
        q: query,
        searchType: "image",
        num: Math.min(numImages, 10),
        safe: "active",
        imgSize: "medium",
        imgType: "photo",
        rights:
          "cc_publicdomain,cc_attribute,cc_sharealike,cc_noncommercial,cc_nonderived",
      });

      if (!response.data.items || response.data.items.length === 0) {
        console.log("📷 No images found for query");
        return [];
      }

      const images = response.data.items.map((item: any, index: number) => ({
        url: item.link,
        title: item.title || `Image ${index + 1}`,
        source: this.extractDomain(item.displayLink || item.link),
        alt_text: item.snippet || item.title || `Relevant image for ${query}`,
        thumbnail_url: item.image?.thumbnailLink,
        width: item.image?.width,
        height: item.image?.height,
        context_url: item.image?.contextLink,
        relevance_score: this.calculateRelevanceScore(item, query, index),
      }));

      console.log(`✅ Found ${images.length} images for research`);
      return images;
    } catch (error: any) {
      console.error(
        "❌ Error searching for images:",
        error?.message || "Unknown error"
      );
      if (error?.message?.includes("quotaExceeded")) {
        throw new Error("Google Custom Search API quota exceeded");
      } else if (error?.message?.includes("invalid")) {
        throw new Error("Invalid Google Custom Search API configuration");
      }

      throw new Error(
        `Image search failed: ${error?.message || "Unknown error"}`
      );
    }
  }

  extractDomain(url: string): string {
    try {
      return url;
    } catch (error) {
      return url;
    }
  }

  calculateRelevanceScore(item: any, query: string, index: number): number {
    let score = 1.0;

    score -= index * 0.1;

    const titleWords = (item.title || "").toLowerCase().split(" ");
    const queryWords = query.toLowerCase().split(" ");
    const titleMatches = queryWords.filter((word: string) =>
      titleWords.some((titleWord: string) => titleWord.includes(word))
    ).length;
    score += (titleMatches / queryWords.length) * 0.3;

    const snippet = (item.snippet || "").toLowerCase();
    const snippetMatches = queryWords.filter((word: string) =>
      snippet.includes(word)
    ).length;
    score += (snippetMatches / queryWords.length) * 0.2;
    return Math.max(0, Math.min(1, score));
  }

  filterByRelevance(
    images: ImageResult[],
    minScore: number = 0.3
  ): ImageResult[] {
    return images.filter((image) => image.relevance_score >= minScore);
  }

  getBestImages(images: ImageResult[], count: number = 3): ImageResult[] {
    return images
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, count);
  }
}

export { ImageSearchService };
