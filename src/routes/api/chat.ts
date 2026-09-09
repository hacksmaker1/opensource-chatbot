import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatRequestBody = { messages?: unknown; persona?: unknown };

const PERSONAS: Record<string, string> = {
  balanced:
    "You are Nova, a warm, precise AI assistant. Answer clearly, use markdown for structure, and keep responses tight unless depth is requested.",
  concise:
    "You are Nova. Answer in as few words as possible while staying correct. Prefer bullet points. Never pad.",
  creative:
    "You are Nova, an imaginative collaborator. Offer vivid ideas, alternatives, and playful phrasing while staying useful.",
  technical:
    "You are Nova, a senior engineer. Be exact, show code with correct syntax highlighting, mention edge cases and trade-offs.",
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response("AI is not configured", { status: 500 });
        }

        const persona =
          typeof body.persona === "string" && body.persona in PERSONAS
            ? body.persona
            : "balanced";

        const gateway = createLovableAiGatewayProvider(key);

        try {
          const result = streamText({
            model: gateway("google/gemini-3.8-flash"),
            system: PERSONAS[persona] ?? PERSONAS["balanced"]!,
            messages: await convertToModelMessages(body.messages as UIMessage[]),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: body.messages as UIMessage[],
          });
        } catch (error) {
          const status =
            typeof error === "object" && error && "statusCode" in error
              ? Number((error as { statusCode: unknown }).statusCode)
              : 500;
          const message =
            status === 429
              ? "Too many requests right now. Try again in a moment."
              : status === 402
                ? "AI credits are exhausted for this workspace."
                : "The assistant could not respond.";
          return new Response(message, { status: Number.isFinite(status) ? status : 500 });
        }
      },
    },
  },
});
