import type { InvalidMathInput } from "../../../SearchError.js"
import { InvalidSamplerConfig } from "../../../SearchError.js"

export const samplerMathError = (operation: string, error: InvalidMathInput): InvalidSamplerConfig =>
  new InvalidSamplerConfig({
    reason: `continuousParzen.${operation}: ${error.reason} (${error.operation})`,
    sampler: "tpe"
  })
