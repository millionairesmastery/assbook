"use client";
import { useEffect, useRef } from "react";

type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: object;
  execute: (input: unknown) => unknown;
};

type ModelContext = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

/**
 * Registers the one agent tool Assbook offers. It only stages text in the
 * visible composer, so the person still presses Post themselves. The text comes
 * from a model, hence untrustedContentHint.
 */
export function useAgentTools(onStage: (text: string) => void) {
  const stage = useRef(onStage);

  useEffect(() => {
    stage.current = onStage;
  }, [onStage]);

  useEffect(() => {
    const context = (
      document as Document & { modelContext?: ModelContext }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "stage_assbook_post",
            description:
              "Place text in the visible Assbook composer for the user to review. Does not publish the post.",
            inputSchema: {
              type: "object",
              properties: {
                text: { type: "string", minLength: 1, maxLength: 500 },
              },
              required: ["text"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== "object" ||
                !("text" in input) ||
                typeof input.text !== "string" ||
                !input.text.trim() ||
                input.text.length > 500
              )
                throw new Error("Provide 1 to 500 characters of text.");
              stage.current(input.text);
              return {
                status: "staged",
                characters: input.text.length,
                published: false,
              };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => console.warn("Assbook agent tools unavailable."));
    } catch {
      console.warn("Assbook agent tools unavailable.");
    }
    return () => controller.abort();
  }, []);
}
