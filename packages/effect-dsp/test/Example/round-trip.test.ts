/**
 * Example and Demonstration schema round-trip proofs.
 */
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example } from "@scenesystems/effect-dsp/Example"
import { Effect, Option, Schema } from "effect"

const expectSchemaRoundTrip = <A, I>(
  schema: Schema.Codec<A, I>,
  value: A
): Effect.Effect<void, never> =>
  Effect.gen(function*() {
    const encoded = yield* Schema.encodeEffect(schema)(value)
    const decoded = yield* Schema.decodeUnknownEffect(schema)(encoded)
    const reEncoded = yield* Schema.encodeEffect(schema)(decoded)

    expect(reEncoded).toEqual(encoded)
  }).pipe(Effect.orDie)

describe("Example", () => {
  it.effect("round-trips labeled examples", () =>
    expectSchemaRoundTrip(
      Example,
      new Example({
        input: {
          question: "What is the capital of France?"
        },
        labels: Option.some({
          answer: "Paris"
        })
      })
    ))

  it.effect("round-trips unlabeled examples", () =>
    expectSchemaRoundTrip(
      Example,
      new Example({
        input: {
          question: "What is the capital of Japan?"
        }
      })
    ))
})

describe("Demonstration", () => {
  it.effect("round-trips complete demonstrations", () =>
    expectSchemaRoundTrip(
      Demonstration,
      new Demonstration({
        input: {
          question: "What is the capital of Italy?"
        },
        output: {
          answer: "Rome"
        }
      })
    ))
})
