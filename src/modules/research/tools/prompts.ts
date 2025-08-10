function getCurrentDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function queryWriterInstructions(
  researchTopic: string,
  currentDate: string,
  numberQueries: number = 3
): string {
  return `Your goal is to generate sophisticated and diverse web search queries. These queries are intended for an advanced automated web research tool capable of analyzing complex results, following links, and synthesizing information.

Instructions:
- Always prefer a single search query, only add another query if the original question requests multiple aspects or elements and one query is not enough.
- Each query should focus on one specific aspect of the original question.
- Don't produce more than ${numberQueries} queries.
- Queries should be diverse, if the topic is broad, generate more than 1 query.
- Don't generate multiple similar queries, 1 is enough.
- Query should ensure that the most current information is gathered. The current date is ${currentDate}.

Format:
- Format your response as a JSON object with ALL two of these exact keys:
   - "rationale": Brief explanation of why these queries are relevant
   - "query": A list of search queries

Example:

Topic: What revenue grew more last year apple stock or the number of people buying an iphone
\`\`\`json
{
    "rationale": "To answer this comparative growth question accurately, we need specific data points on Apple's stock performance and iPhone sales metrics. These queries target the precise financial information needed: company revenue trends, product-specific unit sales figures, and stock price movement over the same fiscal period for direct comparison.",
    "query": ["Apple total revenue growth fiscal year 2024", "iPhone unit sales growth fiscal year 2024", "Apple stock price growth fiscal year 2024"]
}
\`\`\`

Context: ${researchTopic}`;
}

function webSearcherInstructions(researchTopic: string, currentDate: string) {
  return `Conduct comprehensive Google Searches to gather the most recent, credible information on "${researchTopic}" and synthesize it into a detailed, verifiable text artifact.

Instructions:
- Query should ensure that the most current information is gathered. The current date is ${currentDate}.
- Conduct thorough research to gather comprehensive, detailed information.
- Your summary should be DETAILED and COMPREHENSIVE (aim for 400-600 words per search query).
- Include specific facts, statistics, examples, and concrete details from your search results.
- Cover multiple aspects and dimensions of the topic in depth.
- Provide context, background information, and explanations.
- Include recent developments, trends, and current status.
- Consolidate key findings while meticulously tracking the source(s) for each specific piece of information.
- IMPORTANT: Include citations throughout your response using ONLY numbered format: [1], [2], [3], etc. Do NOT use domain names or organization names in citations.
- Use at least 3-5 different source citations throughout your summary.
- The output should be a well-written, detailed summary or report based on your search findings.
- Structure your response with clear sections and comprehensive coverage.
- Only include the information found in the search results, don't make up any information.
- Ensure your summary provides substantial detail that can support comprehensive final analysis.

Research Topic:
${researchTopic}`;
}

function reflectionInstructions(researchTopic: string, summaries: string[]) {
  return `You are an expert research assistant analyzing summaries about "${researchTopic}".

Instructions:
- Identify knowledge gaps or areas that need deeper exploration and generate a follow-up query. (1 or multiple).
- If provided summaries are sufficient to answer the user's question, don't generate a follow-up query.
- If there is a knowledge gap, generate a follow-up query that would help expand your understanding.
- Focus on technical details, implementation specifics, or emerging trends that weren't fully covered.

Requirements:
- Ensure the follow-up query is self-contained and includes necessary context for web search.

Output Format:
- Format your response as a JSON object with these exact keys:
   - "is_sufficient": true or false
   - "knowledge_gap": Describe what information is missing or needs clarification
   - "follow_up_queries": Write a specific question to address this gap

Example:
\`\`\`json
{
    "is_sufficient": true,
    "knowledge_gap": "The summary lacks information about performance metrics and benchmarks",
    "follow_up_queries": ["What are typical performance benchmarks and metrics used to evaluate [specific technology]?"]
}
\`\`\`

Reflect carefully on the Summaries to identify knowledge gaps and produce a follow-up query. Then, produce your output following this JSON format:

Summaries:
${summaries}`;
}

function answerInstructions(
  researchTopic: string,
  summaries: string[],
  currentDate: string
) {
  return `Generate a comprehensive, detailed, and high-quality answer to the user's question based on the provided summaries.

Instructions:
- The current date is ${currentDate}.
- You are the final step of a multi-step research process, don't mention that you are the final step.
- Generate a COMPREHENSIVE and DETAILED response that thoroughly addresses all aspects of the user's question.
- Your response should be substantial (aim for 800-1200 words minimum) and well-structured.
- Use clear headings, subheadings, and bullet points to organize information effectively.
- Provide in-depth analysis, context, and explanations rather than just surface-level information.
- Include specific examples, statistics, and concrete details wherever possible.
- Address multiple perspectives and dimensions of the topic.
- Synthesize information from multiple sources to provide a complete picture.
- Include the sources you used from the Summaries in the answer correctly, use markdown format (e.g. [EPA](https://vertexaisearch.cloud.google.com/id/1-0)). THIS IS A MUST.
- Ensure every major point is properly cited with sources.
- CRITICAL: Include citations throughout your response using recognizable source names in brackets (e.g., [EPA], [Reuters], [Nature], [MIT], [WHO], [IEA], [IRENA], etc.).
- Use at least 8-12 different source citations throughout your comprehensive response.
- Structure your response with:
  * Introduction that sets context
  * Main body with detailed sections covering all aspects
  * Specific examples and case studies where relevant
  * Current trends and future implications
  * Conclusion that synthesizes key insights

User Context:
- ${researchTopic}

Summaries:
${summaries}`;
}

export {
  answerInstructions,
  getCurrentDate,
  queryWriterInstructions,
  reflectionInstructions,
  webSearcherInstructions,
};
