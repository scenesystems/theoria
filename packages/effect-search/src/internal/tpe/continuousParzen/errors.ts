import type { InvalidMathInput } from "../../../Errors/index.js"
import { InvalidSamplerConfig } from "../../../Errors/index.js"

export const samplerMathError = (operation: string, error: InvalidMathInput): InvalidSamplerConfig =>
  new InvalidSamplerConfig({
    reason: `continuousParzen.${operation}: ${error.reason} (${error.operation})`,
    sampler: "tpe"
  })
