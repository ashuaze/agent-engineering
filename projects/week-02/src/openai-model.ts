import OpenAI from "openai";
import * as z from "zod";
import type { FunctionOutput, ModelSession, ModelTurn, Tool } from "./core.js";

/**
 * One instance per run. Uses server-stored response chaining for a short demo.
 * For sensitive workloads, evaluate store:false + complete manual item replay.
 */
export class OpenAIModelSession implements ModelSession {
  private previousResponseId: string | undefined;
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly tools: Tool[],
    private readonly instructions: string
  ) {}

  async next(input: string | FunctionOutput[]): Promise<ModelTurn> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: this.instructions, // must be resent on every request
      store: true,
      parallel_tool_calls: true,
      ...(this.previousResponseId ? { previous_response_id: this.previousResponseId } : {}),
      input: typeof input === "string"
        ? input
        : input.map(o => ({ type: "function_call_output" as const, call_id: o.callId, output: o.output })),
      tools: this.tools.map(tool => ({
        type: "function" as const,
        name: tool.name,
        description: tool.description,
        strict: true,
        // This example uses only a strict-compatible subset of JSON Schema.
        parameters: z.toJSONSchema(tool.schema) as Record<string, unknown>
      }))
    });
    this.previousResponseId = response.id;
    if (response.status !== "completed") throw new Error(`MODEL_STATUS:${response.status}`);
    const calls = response.output.filter(item => item.type === "function_call");
    if (calls.length) {
      return { kind: "calls", calls: calls.map(c => ({
        callId: c.call_id, name: c.name, argumentsJson: c.arguments
      })) };
    }
    if (!response.output_text) throw new Error("EMPTY_MODEL_ANSWER");
    return { kind: "final", text: response.output_text };
  }
}
