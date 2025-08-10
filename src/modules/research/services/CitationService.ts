interface Source {
  url: string;
  title: string;
  snippet: string;
  citationId?: string;
}

interface CitationValidation {
  hasCitations: boolean;
  citationCount: number;
  citations: string[];
}

class CitationService {
  static addCitations(text: string, sources: Source[]): string {
    if (!sources || sources.length === 0) {
      return text;
    }

    let citedText = text;
    const citationMap = new Map();
    sources.forEach((source, index) => {
      const citationId = index + 1;
      citationMap.set(source.url, citationId);
    });
    const citationList = sources
      .map((source: Source, index: number) => {
        const citationId = index + 1;
        return `[${citationId}] ${source.title} - ${source.url}`;
      })
      .join("\n");

    citedText += "\n\n## Sources\n\n" + citationList;

    return citedText;
  }

  static extractSources(webSearchResults: any[]): Source[] {
    const sourceMap = new Map();
    let citationId = 1;

    for (const result of webSearchResults) {
      if (result.results) {
        for (const item of result.results) {
          if (!sourceMap.has(item.url)) {
            sourceMap.set(item.url, {
              url: item.url,
              title: item.title,
              snippet: item.snippet,
              citationId: citationId.toString(),
            });
            citationId++;
          }
        }
      }
    }

    return Array.from(sourceMap.values());
  }

  static formatCitations(
    sources: Source[],
    style: string = "numbered"
  ): string {
    if (!sources || sources.length === 0) {
      return "";
    }

    switch (style) {
      case "numbered":
        return sources
          .map(
            (source: Source, index: number) =>
              `[${index + 1}] ${source.title} - ${source.url}`
          )
          .join("\n");

      case "apa":
        return sources
          .map((source) => {
            const title = source.title;
            const url = source.url;
            const domain = new URL(url).hostname;
            return `${title}. Retrieved from ${domain}: ${url}`;
          })
          .join("\n\n");

      case "mla":
        return sources
          .map((source) => {
            const title = source.title;
            const url = source.url;
            const domain = new URL(url).hostname;
            const date = new Date().toLocaleDateString();
            return `"${title}." ${domain}, ${date}, ${url}.`;
          })
          .join("\n\n");

      default:
        return this.formatCitations(sources, "numbered");
    }
  }

  static insertInlineCitations(
    text: string,
    sources: Source[],
    citationMap: Map<string, number>
  ): string {
    let citedText = text;
    sources.forEach((source, index) => {
      const citationId = index + 1;
      const keywords = source.title.split(" ").slice(0, 3).join(" ");
      const regex = new RegExp(`\\b${keywords}\\b`, "gi");
      citedText = citedText.replace(regex, `${keywords} [${citationId}]`);
    });

    return citedText;
  }
  static validateCitations(text: string): CitationValidation {
    const citationPattern = /\[\d+\]/g;
    const citations = text.match(citationPattern) || [];

    return {
      hasCitations: citations.length > 0,
      citationCount: citations.length,
      citations: citations,
    };
  }
  static generateBibliography(
    sources: Source[],
    style: string = "numbered"
  ): string {
    if (!sources || sources.length === 0) {
      return "";
    }

    const bibliography = this.formatCitations(sources, style);

    return `## Bibliography\n\n${bibliography}`;
  }
}

export default CitationService;
