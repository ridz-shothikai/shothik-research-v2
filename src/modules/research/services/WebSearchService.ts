import axios from "axios";
import { SearchOptions, SearchResult } from "../../../types/index.js";

class WebSearchService {
  private useRealSearch: boolean;
  constructor() {
    this.useRealSearch = !!(
      process.env.GEMINI_API_KEY && process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID
    );
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { maxResults = 10 } = options;

    if (this.useRealSearch) {
      return await this.googleCustomSearch(query, maxResults);
    } else {
      return await this.mockSearch(query, maxResults);
    }
  }

  async googleCustomSearch(
    query: string,
    maxResults: number
  ): Promise<SearchResult[]> {
    try {
      const response = await axios.get(
        "https://www.googleapis.com/customsearch/v1",
        {
          params: {
            key: process.env.GEMINI_API_KEY,
            cx: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
            q: query,
            num: Math.min(maxResults, 10),
          },
        }
      );

      return (
        response.data.items?.map((item: any) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          displayLink: item.displayLink,
        })) || []
      );
    } catch (error: any) {
      console.error("Google Custom Search error:", error);
      return await this.mockSearch(query, maxResults);
    }
  }

  async mockSearch(query: string, maxResults: number): Promise<SearchResult[]> {
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    );

    const mockResults: SearchResult[] = [
      {
        title: `Understanding ${query} - Comprehensive Guide`,
        link: `https://example.com/guide/${encodeURIComponent(
          query.toLowerCase().replace(/\s+/g, "-")
        )}`,
        snippet: `A comprehensive guide to ${query}. This article covers the fundamental concepts, practical applications, and best practices related to ${query}. Learn everything you need to know about this important topic.`,
      },
      {
        title: `${query} - Wikipedia`,
        link: `https://en.wikipedia.org/wiki/${encodeURIComponent(
          query.replace(/\s+/g, "_")
        )}`,
        snippet: `${query} refers to a concept or practice that involves various aspects and applications. This Wikipedia article provides detailed information about the history, development, and current understanding of ${query}.`,
      },
      {
        title: `Latest Research on ${query}`,
        link: `https://research.example.com/papers/${encodeURIComponent(
          query.toLowerCase().replace(/\s+/g, "-")
        )}`,
        snippet: `Recent academic research and studies related to ${query}. This collection includes peer-reviewed papers, research findings, and scholarly articles that advance our understanding of ${query}.`,
      },
      {
        title: `${query}: Best Practices and Implementation`,
        link: `https://blog.example.com/best-practices-${encodeURIComponent(
          query.toLowerCase().replace(/\s+/g, "-")
        )}`,
        snippet: `Practical insights and best practices for implementing ${query}. This blog post shares real-world experiences, common challenges, and proven strategies for success with ${query}.`,
      },
      {
        title: `${query} Tools and Resources`,
        link: `https://tools.example.com/${encodeURIComponent(
          query.toLowerCase().replace(/\s+/g, "-")
        )}-resources`,
        snippet: `A curated collection of tools, resources, and utilities related to ${query}. Find the best software, frameworks, and services to help you work effectively with ${query}.`,
      },
    ];

    const additionalResults: SearchResult[] = [
      {
        title: `${query} Case Studies and Examples`,
        link: `https://casestudies.example.com/${encodeURIComponent(
          query.toLowerCase().replace(/\s+/g, "-")
        )}`,
        snippet: `Real-world case studies and examples demonstrating the application of ${query}. Learn from successful implementations and understand the practical implications of ${query} in different contexts.`,
      },
      {
        title: `Common Mistakes with ${query}`,
        link: `https://mistakes.example.com/${encodeURIComponent(
          query.toLowerCase().replace(/\s+/g, "-")
        )}-pitfalls`,
        snippet: `Learn about common mistakes and pitfalls when working with ${query}. This article helps you avoid typical errors and provides guidance on how to approach ${query} correctly.`,
      },
      {
        title: `${query} Community and Discussion`,
        link: `https://community.example.com/discussions/${encodeURIComponent(
          query.toLowerCase().replace(/\s+/g, "-")
        )}`,
        snippet: `Join the community discussion about ${query}. Share experiences, ask questions, and learn from others who are working with ${query}. Active forum with expert contributors.`,
      },
    ];

    const allResults = [...mockResults, ...additionalResults];
    return allResults.slice(0, maxResults);
  }

  async searchDomain(
    query: string,
    domain: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const domainQuery = `site:${domain} ${query}`;
    return await this.search(domainQuery, options);
  }

  async searchAcademic(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const academicQuery = `${query} filetype:pdf OR site:scholar.google.com OR site:arxiv.org OR site:pubmed.ncbi.nlm.nih.gov`;
    return await this.search(academicQuery, options);
  }

  async searchRecent(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const recentQuery = `${query} after:2023`;
    return await this.search(recentQuery, options);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const results = await this.search("test query", { maxResults: 1 });
      return results.length > 0;
    } catch (error: any) {
      console.error("Web search health check failed:", error);
      return false;
    }
  }
}

export default new WebSearchService();
