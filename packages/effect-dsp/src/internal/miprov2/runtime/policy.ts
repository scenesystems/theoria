/** Pinned GroundedProposer tip order and response prefix handling. @internal */
import { String as Str } from "effect"

// Object insertion order is the order of DSPy's TIPS.keys() choice population.
export const tips = {
  none: "",
  creative: "Don't be afraid to be creative when creating the new instruction!",
  simple: "Keep the instruction clear and concise.",
  description: "Make sure your instruction is very informative and descriptive.",
  high_stakes: "The instruction should include a high stakes scenario in which the LM must solve the task!",
  persona: "Include a persona that is relevant to the task in the instruction (ie. \"You are a ...\")"
}

export const stripPrefix = (text: string) =>
  Str.replace(/^"+|"+$/g, "")(Str.replace(/^[*\s]*(([\w'-]+\s+){0,4}[\w'-]+):\s*/, "")(text))
