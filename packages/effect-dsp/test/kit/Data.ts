import { Example } from "@scenesystems/effect-dsp/Example"
import { Array as Arr, Effect, Random, Schema } from "effect"

const Options = Schema.Struct({ labeled: Schema.Boolean, seed: Schema.Finite })

/** IDs are carried in input/output until Example gains a first-class id in Wave 1. */
export const dataset = (n: number, options: typeof Options.Type) =>
  Effect.forEach(Arr.makeBy(n, (i) => i), (i) =>
    Effect.gen(function*() {
      const id = `example-${options.seed}-${i}`
      const value = yield* Random.nextIntBetween(0, 1000000)
      return new Example({
        input: { id, question: `question-${value}` },
        ...(options.labeled ? { output: { id, answer: `answer-${value}` } } : {})
      })
    })).pipe(Random.withSeed(options.seed))
