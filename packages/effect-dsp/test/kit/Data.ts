import { Example, Id } from "@scenesystems/effect-dsp/Example"
import { Array as Arr, Boolean as Bool, Effect, Option, Random, Schema } from "effect"

const Options = Schema.Struct({ labeled: Schema.Boolean, seed: Schema.Finite })

/** Seeded data with explicit stable example identities. */
export const dataset = (n: number, options: typeof Options.Type) =>
  Effect.forEach(Arr.makeBy(n, (i) => i), (i) =>
    Effect.gen(function*() {
      const id = `example-${options.seed}-${i}`
      const value = yield* Random.nextIntBetween(0, 1000000)
      return new Example({
        id: Option.some(yield* Schema.decodeEffect(Id)(id)),
        input: { id, question: `question-${value}` },
        ...Bool.match(options.labeled, {
          onTrue: () => ({ labels: Option.some({ id, answer: `answer-${value}` }) }),
          onFalse: () => ({})
        })
      })
    })).pipe(Random.withSeed(options.seed))
