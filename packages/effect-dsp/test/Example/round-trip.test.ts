/**
 * Example and Demo schema round-trip proofs.
 */
import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { Demo, Example } from "effect-dsp/Example"

const expectSchemaRoundTrip = <A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A
): void => {
  const encoded = Schema.encodeSync(schema)(value)
  const decoded = Schema.decodeUnknownSync(schema)(encoded)
  const reEncoded = Schema.encodeSync(schema)(decoded)

  expect(reEncoded).toEqual(encoded)
}

describe("Example", () => {
  it("round-trips labeled examples", () => {
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
    )
  })

  it("round-trips contextual example metadata", () => {
    expectSchemaRoundTrip(
      Example,
      new Example({
        input: {
          question: "What is the capital of France?"
        },
        output: {
          answer: "Paris"
        },
        metadata: {
          fixtureId: "amp-counter-items"
        }
      })
    )
  })

  it("round-trips unlabeled examples", () => {
    expectSchemaRoundTrip(
      Example,
      new Example({
        input: {
          question: "What is the capital of Japan?"
        }
      })
    )
  })
})

describe("Demo", () => {
  it("round-trips complete demonstrations", () => {
    expectSchemaRoundTrip(
      Demo,
      new Demo({
        input: {
          question: "What is the capital of Italy?"
        },
        output: {
          answer: "Rome"
        }
      })
    )
  })
})
