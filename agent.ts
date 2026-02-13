// ============================================
// AGENT LOOP - The core of everything
// ============================================
// This is the entire agent in one function.
// No frameworks. No magic. Just a loop:
//
// 1. Send messages + tools to the LLM
// 2. If the LLM wants to call a tool → run it, send result back
// 3. If the LLM gives a final text answer → we're done
// 4. Repeat until finished (with a safety limit)
//
// That's it. That's what every AI agent framework
// is doing under the hood. Now you can see it.

import type { Provider } from "./providers";
import { toolSchemas, toolHandlers } from "./tools";

// --- Pretty terminal colors ---
const c = {
  dim: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

// --- Types (matching OpenAI-compatible format) ---

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
};

type ChatResponse = {
  choices: {
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
  };
};

// --- The actual API call ---

async function callLLM(
  provider: Provider,
  messages: Message[]
): Promise<ChatResponse> {
  const response = await fetch(
    `${provider.baseURL}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        tools: toolSchemas,
        tool_choice: "auto", // Let the LLM decide when to use tools
        temperature: 0.3,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    // Sanitize error - don't leak API keys or internal details
    const sanitized = error.replace(/sk-[a-zA-Z0-9]+/g, "sk-***")
                           .replace(/"api_key"\s*:\s*"[^"]*"/g, '"api_key": "***"')
                           .slice(0, 200);
    throw new Error(`API error (${response.status}): ${sanitized}`);
  }

  return response.json() as Promise<ChatResponse>;
}

// --- The Agent Loop ---

// --- Interactive Chat (maintains conversation history) ---

export function createChat(
  provider: Provider,
  systemPrompt: string,
  maxIterations: number = 25 // High safety cap — the agent decides when to stop, not us
) {
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
  ];

  return async function chat(userMessage: string): Promise<string> {
    messages.push({ role: "user", content: userMessage });

    let totalIn = 0, totalOut = 0, totalCached = 0;
    const startTime = performance.now();
    console.log();

    for (let i = 0; i < maxIterations; i++) {
      console.log(c.dim(`  ● Step ${i + 1} ${"─".repeat(40)}`));

      const response = await callLLM(provider, messages);

      // Token tracking
      let tokenLine = "";
      if (response.usage) {
        const u = response.usage;
        totalIn += u.prompt_tokens;
        totalOut += u.completion_tokens;
        totalCached += u.prompt_cache_hit_tokens || 0;
        const cacheRate = u.prompt_cache_hit_tokens
          ? ((u.prompt_cache_hit_tokens / u.prompt_tokens) * 100).toFixed(0)
          : "0";
        tokenLine = c.dim(`    📊 ${u.prompt_tokens.toLocaleString()} in │ ${u.completion_tokens.toLocaleString()} out │ ${cacheRate}% cached`);
      }

      const choice = response.choices[0];
      if (!choice) throw new Error("No response from LLM");
      const assistantMessage = choice.message;

      messages.push(assistantMessage as Message);

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          // Pretty tool-specific output
          if (toolName === "think") {
            const thought = toolArgs.thought || "";
            console.log(`    💭 ${c.magenta(thought.slice(0, 100))}${thought.length > 100 ? c.dim("...") : ""}`);
          } else if (toolName === "web_search") {
            console.log(`    🔍 ${c.cyan(`"${toolArgs.query}"`)}`);
          } else {
            console.log(`    🔧 ${c.yellow(toolName)}(${JSON.stringify(toolArgs)})`);
          }

          const handler = toolHandlers[toolName];
          if (!handler) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error: Unknown tool "${toolName}"`,
            });
            console.log(`    ${c.red("✗ Unknown tool")}`);
            continue;
          }

          const toolStart = performance.now();
          const result = await handler(toolArgs);
          const elapsed = ((performance.now() - toolStart) / 1000).toFixed(2);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });

          if (toolName !== "think") {
            console.log(c.dim(`    ✓ ${elapsed}s`));
          }
        }
        if (tokenLine) console.log(tokenLine);
      } else {
        const answer = assistantMessage.content || "No response";
        const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
        const overallCache = totalIn > 0 ? ((totalCached / totalIn) * 100).toFixed(0) : "0";
        console.log();
        console.log(c.green(`  ✅ Done in ${i + 1} steps (${totalTime}s)`));
        console.log(c.dim(`  📊 Total: ${totalIn.toLocaleString()} in │ ${totalOut.toLocaleString()} out │ ${overallCache}% cached`));
        console.log();
        return answer;
      }
    }

    return "Reached max iterations.";
  };
}

// --- One-shot Agent (original) ---

export async function runAgent(
  provider: Provider,
  systemPrompt: string,
  userMessage: string,
  maxIterations: number = 10 // Safety limit to prevent infinite loops
): Promise<string> {
  // Build the conversation history
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  console.log(`\n🤖 Agent running on ${provider.name} (${provider.model})`);
  console.log(`📝 Task: "${userMessage}"\n`);

  for (let i = 0; i < maxIterations; i++) {
    console.log(`--- Iteration ${i + 1} ---`);

    // Step 1: Call the LLM
    const response = await callLLM(provider, messages);
    const choice = response.choices[0];
    if (!choice) throw new Error("No response from LLM");
    const assistantMessage = choice.message;

    // Add the assistant's response to conversation history
    messages.push(assistantMessage as Message);

    // Step 2: Check if the LLM wants to use tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(
        `  🔧 LLM wants to use ${assistantMessage.tool_calls.length} tool(s)`
      );

      // Run each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        console.log(`  → Calling: ${toolName}(${JSON.stringify(toolArgs)})`);

        // Look up and run the tool handler
        const handler = toolHandlers[toolName];
        if (!handler) {
          // Tool not found - tell the LLM
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `Error: Unknown tool "${toolName}"`,
          });
          continue;
        }

        // Run the tool and get the result
        const start = performance.now();
        const result = await handler(toolArgs);
        const elapsed = ((performance.now() - start) / 1000).toFixed(2);

        // Send the result back to the LLM
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });

        console.log(`  ✅ ${toolName} completed (${elapsed}s)`);
      }

      // Loop continues - LLM will see the tool results next iteration

    } else {
      // Step 3: No tool calls = LLM is giving its final answer
      const finalAnswer = assistantMessage.content || "No response";
      console.log(`\n✅ Agent finished in ${i + 1} iteration(s)\n`);
      return finalAnswer;
    }
  }

  // Safety limit reached
  return "Agent reached maximum iterations without a final answer.";
}
