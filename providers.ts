// ============================================
// PROVIDERS - Swap LLMs by changing one line
// ============================================
// Most LLM providers now use the OpenAI-compatible
// chat completions format. Same shape request,
// same shape response. Just different URLs.

export type Provider = {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
};

// --- Add your API keys to a .env file ---
// DEEPSEEK_API_KEY=sk-xxx
// MISTRAL_API_KEY=xxx
// OPENAI_API_KEY=sk-xxx
// GROQ_API_KEY=xxx
// GEMINI_API_KEY=xxx

export const providers = {
  deepseek: {
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    model: "deepseek-chat", // or "deepseek-reasoner" for R1
  },

  mistral: {
    name: "Mistral",
    baseURL: "https://api.mistral.ai/v1",
    apiKey: process.env.MISTRAL_API_KEY || "",
    model: "mistral-large-latest",
  },

  groq: {
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY || "",
    model: "llama-3.1-8b-instant",
  },

  openai: {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY || "",
    model: "gpt-4o",
  },

  minimax: {
    name: "MiniMax",
    baseURL: "https://api.minimax.io/v1",
    apiKey: process.env.MINIMAX_API_KEY || "",
    model: "MiniMax-M2.5",
  },

  // Gemini via OpenAI-compatible endpoint
  // Requires key in URL query param AND header for some models
  gemini: {
    name: "Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: process.env.GEMINI_API_KEY || "",
    model: "gemini-2.0-flash-exp",
  },

  // Local models via Ollama (free, no API key)
  ollama: {
    name: "Ollama",
    baseURL: "http://localhost:11434/v1",
    apiKey: "ollama", // Ollama ignores this but the field is required
    model: "llama3.1:8b",
  },
} as const satisfies Record<string, Provider>;

// --- Helper to get full URL with API key (needed for Gemini) ---
export function getFullURL(provider: Provider): string {
  const url = new URL(`${provider.baseURL}/chat/completions`);
  // Some providers need the key as a query param
  if (provider.name === "Gemini") {
    url.searchParams.set("key", provider.apiKey);
  }
  return url.toString();
}

// --- Helper for headers (different for Gemini) ---
export function getAuthHeaders(provider: Provider): Record<string, string> {
  if (provider.name === "Gemini") {
    // Gemini with OpenAI compat endpoint uses key in URL, no auth header needed
    return { "Content-Type": "application/json" };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.apiKey}`,
  };
}
