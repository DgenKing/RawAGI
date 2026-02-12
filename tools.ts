// ============================================
// TOOLS - Functions your agent can use
// ============================================

// --- Tool Schemas (what the LLM sees) ---

export const toolSchemas = [
  {
    type: "function" as const,
    function: {
      name: "think",
      description: `Use this tool to plan your research strategy, reflect on findings, and decide next steps. This is your internal scratchpad.

Use it:
- BEFORE searching: plan which angles to cover, estimate depth needed
- BETWEEN searches: assess what you found, identify gaps, decide whether to go deeper or pivot
- BEFORE answering: verify you have enough coverage and your sources are solid

This tool has no side effects — it just helps you reason strategically.`,
      parameters: {
        type: "object",
        properties: {
          thought: {
            type: "string",
            description: "Your strategic reasoning — what you know, what's missing, what to do next",
          },
        },
        required: ["thought"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search the web for current information. Use this when you need up-to-date facts, news, or data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query — be specific and targeted",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read the contents of a local file.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The file path to read",
          },
        },
        required: ["path"],
      },
    },
  },
];

// --- Tool Handlers (what actually runs) ---

type ToolHandler = (args: Record<string, string | undefined>) => Promise<string>;

export const toolHandlers: Record<string, ToolHandler> = {
  think: async ({ thought = "" }) => {
    console.log(`  💭 Thinking: "${thought.slice(0, 80)}..."`);
    // The think tool doesn't do anything external — it just lets the LLM
    // reason in a structured way. The thought is already in the conversation
    // history, so the LLM can reference it in future turns.
    return "Strategy noted. Continue with your plan.";
  },

  web_search: async ({ query = "" }) => {
    console.log(`  🔍 Searching: "${query}"`);

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return "Error: TAVILY_API_KEY not set in .env";
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        include_answer: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return `Search error (${response.status}): ${error}`;
    }

    const data = (await response.json()) as {
      answer?: string;
      results: { title: string; url: string; content: string }[];
    };

    let output = "";

    if (data.answer) {
      output += `Summary: ${data.answer}\n\n`;
    }

    for (const result of data.results) {
      const snippet = result.content.length > 300
        ? result.content.slice(0, 300) + "..."
        : result.content;
      output += `Title: ${result.title}\n`;
      output += `URL: ${result.url}\n`;
      output += `${snippet}\n\n`;
    }

    return output;
  },

  read_file: async ({ path = "" }) => {
    console.log(`  📄 Reading file: ${path}`);
    try {
      const file = Bun.file(path);
      return await file.text();
    } catch (error) {
      return `Error reading file: ${error}`;
    }
  },
};
