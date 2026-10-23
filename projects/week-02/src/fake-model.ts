import type { FunctionOutput, ModelSession, ModelTurn } from "./core.js";

export class ScriptedModel implements ModelSession {
  private index = 0;
  readonly seenInputs: Array<string | FunctionOutput[]> = [];
  constructor(private readonly turns: ModelTurn[]) {}
  async next(input: string | FunctionOutput[]): Promise<ModelTurn> {
    this.seenInputs.push(input);
    const result = this.turns[this.index++];
    if (!result) throw new Error("SCRIPT_EXHAUSTED");
    return result;
  }
}
