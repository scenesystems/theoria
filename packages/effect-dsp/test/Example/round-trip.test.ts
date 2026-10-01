/**
 * Example and Demonstration schema round-trip proofs.
 */
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example } from "@scenesystems/effect-dsp/Example"
import { Effect, Schema } from "effect"

const expectSchemaRoundTrip = <A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A
): Effect.Effect<void, never> =>
  Effect.gen(function*() {
    const encoded = yield* Schema.encode(schema)(value)
    const decoded = yield* Schema.decodeUnknown(schema)(encoded)
    const reEncoded = yield* Schema.encode(schema)(decoded)

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
        output: {
          answer: "Paris"
        }
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
