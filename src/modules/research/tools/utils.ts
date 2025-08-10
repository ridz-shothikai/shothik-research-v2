function getResearchTopic(messages: any[]) {
  if (!messages || messages.length === 0) {
    return "";
  }

  if (messages.length === 1) {
    return messages[messages.length - 1].content || "";
  } else {
    let researchTopic = "";
    for (const message of messages) {
      if (message.role === "user" || message.type === "human") {
        researchTopic += `User: ${message.content}\n`;
      } else if (message.role === "assistant" || message.type === "ai") {
        researchTopic += `Assistant: ${message.content}\n`;
      }
    }
    return researchTopic;
  }
}

function resolveUrls(urlsToResolve: any[], id: string) {
  const prefix = "https://vertexaisearch.cloud.google.com/id/";
  const urls = urlsToResolve.map((site) =>
    site.web && site.web.uri ? site.web.uri : site.url || site
  );

  const resolvedMap: Record<string, string> = {};
  for (let idx = 0; idx < urls.length; idx++) {
    const url = urls[idx];
    if (!(url in resolvedMap)) {
      resolvedMap[url] = `${prefix}${id}-${idx}`;
    }
  }

  return resolvedMap;
}

function insertCitationMarkers(text: string, citationsList: any[]) {
  if (!citationsList || citationsList.length === 0) {
    return text;
  }

  const sortedCitations = [...citationsList].sort(
    (a, b) => b.start_index - a.start_index
  );

  let modifiedText = text;

  for (const citation of sortedCitations) {
    const startIndex = citation.start_index || 0;
    const endIndex = citation.end_index || startIndex;
    const segmentString = citation.segment_string || "";

    modifiedText =
      modifiedText.slice(0, endIndex) +
      segmentString +
      modifiedText.slice(endIndex);
  }

  return modifiedText;
}

function getCitations(
  response: any,
  resolvedUrlsMap: Record<string, string> = {}
) {
  const citations: any[] = [];

  const groundingMetadata = response.response_metadata?.groundingMetadata || {};
  const groundingChunks = groundingMetadata.groundingChunks || [];
  const groundingSupports = groundingMetadata.groundingSupports || [];

  if (groundingChunks.length === 0) {
    return citations;
  }

  for (const support of groundingSupports) {
    const citation = {
      start_index: support.segment?.startIndex || 0,
      end_index: support.segment?.endIndex || 0,
      segments: [] as any[],
      segment_string: "",
      sources: [] as any[],
    };

    if (support.groundingChunkIndices) {
      for (const chunkIndex of support.groundingChunkIndices) {
        if (chunkIndex < groundingChunks.length) {
          const chunk = groundingChunks[chunkIndex];
          const web = chunk.web;

          if (web && web.uri) {
            const originalUrl = web.uri;
            const resolvedUrl =
              resolvedUrlsMap[originalUrl] ||
              `https://vertexaisearch.cloud.google.com/id/${chunkIndex}`;
            const title = web.title || extractDomain(originalUrl);

            const source = {
              url: originalUrl,
              title: title,
              resolved_url: resolvedUrl,
            };

            citation.segments.push(source);
            citation.sources.push(source);
          }
        }
      }
    }

    if (citation.segments.length > 0) {
      citations.push(citation);
    }
  }

  if (citations.length === 0 && groundingChunks.length > 0) {
    for (let i = 0; i < groundingChunks.length; i++) {
      const chunk = groundingChunks[i];
      const web = chunk.web;

      if (web && web.uri) {
        const originalUrl = web.uri;
        const resolvedUrl =
          resolvedUrlsMap[originalUrl] ||
          `https://vertexaisearch.cloud.google.com/id/${i}`;
        const title = web.title || extractDomain(originalUrl);

        let citation = citations.find(
          (c) => c.start_index === 0 && c.end_index === 0
        );
        if (!citation) {
          citation = {
            start_index: 0,
            end_index: 0,
            segments: [] as any[],
            sources: [] as any[],
            segment_string: response.content.slice(0, 0),
          };
          citations.push(citation);
        }

        citation.segments.push({
          url: originalUrl,
          title: title,
          resolved_url: resolvedUrl,
        });
        citation.sources.push({
          url: originalUrl,
          title: title,
          resolved_url: resolvedUrl,
        });
      }
    }
  }

  return citations;
}

function formatSources(sources: any[]) {
  if (!sources || sources.length === 0) {
    return "";
  }

  return sources
    .map((source, index) => {
      const title = source.title || "Untitled";
      const url = source.url || "#";
      return `[${index + 1}] ${title} - ${url}`;
    })
    .join("\n");
}

function deduplicateSources(sources: any[]) {
  if (!sources || sources.length === 0) {
    return [];
  }

  const seen = new Set();
  const deduplicated = [];

  for (const source of sources) {
    const url = source.url || source.uri || "";
    if (url && !seen.has(url)) {
      seen.add(url);
      deduplicated.push(source);
    }
  }

  return deduplicated;
}

function extractDomain(url: string) {
  try {
    return url;
  } catch (error) {
    return url;
  }
}

function cleanText(text: string) {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

function truncateText(text: string, maxLength = 200) {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + "...";
}

function summarizeSearchResults(results: any[]) {
  if (!results || results.length === 0) {
    return "No search results found.";
  }

  const summaries = results.map((result) => {
    const title = result.title || "Untitled";
    const snippet = truncateText(
      result.snippet || result.description || "",
      150
    );
    const url = result.url || result.link || "";

    return `**${title}**\n${snippet}\nSource: ${url}`;
  });

  return summaries.join("\n\n");
}

function extractSourcesFromContent(
  content: string,
  existingGroundingSources: any[] = []
) {
  if (!content) return [];

  const sources: any[] = [];
  const numberedCitationRegex = /\[(\d+)\]/g;
  let match;
  while ((match = numberedCitationRegex.exec(content)) !== null) {
    const citationNumber = parseInt(match[1]);
    if (
      citationNumber > 0 &&
      citationNumber <= existingGroundingSources.length
    ) {
    }
  }

  const uniqueSources = sources.filter(
    (source, index, self) =>
      index === self.findIndex((s) => s.title === source.title)
  );

  return uniqueSources;
}

export {
  cleanText,
  deduplicateSources,
  extractDomain,
  extractSourcesFromContent,
  formatSources,
  getCitations,
  getResearchTopic,
  insertCitationMarkers,
  resolveUrls,
  summarizeSearchResults,
  truncateText,
};
