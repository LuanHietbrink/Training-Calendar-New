import Anthropic from "@anthropic-ai/sdk";
import { INTENSITIES, SESSION_TYPES, runTool } from "./tools";

/**
 * Claude tool-use agent for the WhatsApp training assistant.
 * Persisted conversation history is kept as plain text turns (StoredTurn) so
 * that trimming can never leave a dangling tool_use block; the tool-call
 * round-trips happen inside a single runAgent() invocation only.
 */

export interface StoredTurn {
  role: "user" | "assistant";
  text: string;
}

const MAX_TURNS = 10; // persisted conversational turns
const MAX_TOOL_ITERATIONS = 8; // safety cap on tool round-trips per message

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "query_sessions",
    description:
      "Search the athlete's training sessions. Use this to answer questions about past " +
      "sessions, including exercise loads/weights which live in the free-text `title` and " +
      "`actual_notes` fields (there is no structured weight column). Weekly-recurring sessions " +
      "are expanded into individual dated occurrences, so `count` reflects real occurrences.",
    input_schema: {
      type: "object",
      properties: {
        date_from: { type: "string", description: "Inclusive start date, YYYY-MM-DD" },
        date_to: { type: "string", description: "Inclusive end date, YYYY-MM-DD" },
        session_type: { type: "string", enum: [...SESSION_TYPES] },
        completed: { type: "boolean", description: "Filter by completion status" },
        text_search: {
          type: "string",
          description: "Case-insensitive substring match on title/notes, e.g. 'bench press'",
        },
        limit: { type: "number", description: "Max rows to return (default 50, max 100)" },
      },
    },
  },
  {
    name: "add_session",
    description:
      "Add a new training session. Confirm the parsed details with the user before calling. " +
      "Put exercises and loads (e.g. 'Bench press 80kg 5x5') in `title` and/or `actual_notes`.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        start_time: { type: "string", description: "HH:MM 24h, optional" },
        session_type: { type: "string", enum: [...SESSION_TYPES] },
        intensity: { type: "string", enum: [...INTENSITIES] },
        title: { type: "string", description: "Short summary, e.g. '6 x 200m @ 28s' or 'Bench 80kg 5x5'" },
        planned_notes: { type: "string" },
        actual_notes: { type: "string" },
        completed: { type: "boolean", description: "True if this session already happened" },
      },
      required: ["date", "session_type", "intensity", "title"],
    },
  },
  {
    name: "update_session",
    description:
      "Update an existing session by id (obtain the id first via query_sessions). " +
      "Use to mark a session complete or to amend notes.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Session id from query_sessions" },
        completed: { type: "boolean" },
        title: { type: "string" },
        start_time: { type: "string" },
        session_type: { type: "string", enum: [...SESSION_TYPES] },
        intensity: { type: "string", enum: [...INTENSITIES] },
        planned_notes: { type: "string" },
        actual_notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "query_weights",
    description: "Look up body-weight log entries (kg) in a date range. This is body weight, NOT lifting load.",
    input_schema: {
      type: "object",
      properties: {
        date_from: { type: "string", description: "YYYY-MM-DD" },
        date_to: { type: "string", description: "YYYY-MM-DD" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "query_splits",
    description: "Look up speed split times (10/20/30m fly) in a date range.",
    input_schema: {
      type: "object",
      properties: {
        date_from: { type: "string", description: "YYYY-MM-DD" },
        date_to: { type: "string", description: "YYYY-MM-DD" },
        distance: { type: "number", enum: [10, 20, 30] },
        limit: { type: "number" },
      },
    },
  },
];

function systemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    "You are a concise WhatsApp assistant for a 400m hurdler's training log.",
    `Today's date is ${today}. Resolve relative dates ("last 3 months", "yesterday") against it.`,
    "",
    "Data model:",
    `- sessions: date, start_time, session_type (${SESSION_TYPES.join("/")}), intensity (${INTENSITIES.join("/")}), title, planned_notes, actual_notes, completed. Weekly-recurring sessions repeat until a stop date.`,
    "- Exercise weights/loads are NOT a structured field. They live in the free-text `title` and `actual_notes`. To answer a load question (e.g. bench press weight), call query_sessions (use text_search and/or a date) and read those fields.",
    "- query_weights is BODY weight only; query_splits is sprint timing.",
    "",
    "Conventions:",
    "- The athlete is in South Africa: interpret ambiguous numeric dates as DAY/MONTH/YEAR, and default loads to kilograms.",
    "- If a date or value is genuinely ambiguous or missing, ask one short clarifying question instead of guessing.",
    "- Before adding a session, restate the parsed details in one short line and add it; report the result plainly.",
    "- Keep replies short and mobile-friendly (a few lines, no markdown tables). If you have no data, say so.",
  ].join("\n");
}

export async function runAgent(
  prior: StoredTurn[],
  userText: string,
): Promise<{ reply: string; turns: StoredTurn[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    ...prior.map((t) => ({ role: t.role, content: t.text }) as Anthropic.MessageParam),
    { role: "user", content: userText },
  ];

  let reply = "";
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(),
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason === "tool_use") {
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;
        try {
          const result = await runTool(block.name, block.input);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: (err as Error).message }),
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    reply = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    break;
  }

  if (!reply) reply = "Sorry, I couldn't work that out. Could you rephrase?";

  const turns: StoredTurn[] = [
    ...prior,
    { role: "user" as const, text: userText },
    { role: "assistant" as const, text: reply },
  ].slice(-MAX_TURNS);

  return { reply, turns };
}
