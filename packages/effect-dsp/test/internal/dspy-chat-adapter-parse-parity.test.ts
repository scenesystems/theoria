import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Record, Schema } from "effect"

import { parseTextOutput } from "../../src/internal/parse/decode.js"
import { extractMarkedRecord } from "../../src/internal/parse/protocol.js"
import { ChatParseSectionsFixtureSchema, makeFixtureRegistry } from "../helpers/dspy-fixtures/index.js"

const AnswerSchema = Schema.Struct({ answer: Schema.String })

describe("internal/parse DSPy contract parity", () => {
  it.effect("matches DSPy section extraction + parsed field contract", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const rawFixture = yield* registry.load("dspy.chat.parse-sections.basic")
      const fixture = yield* Schema.decodeUnknown(ChatParseSectionsFixtureSchema)(rawFixture)

      const parsed = yield* parseTextOutput("qa", AnswerSchema, fixture.payload.completion)
      const extracted = extractMarkedRecord(fixture.payload.completion)
      const extractedAnswer = Option.getOrElse(Record.get(extracted, "answer"), () => "")

      expect(fixture.payload.fieldHeaderPattern).toContain("(\\w+)")
      expect(Arr.map(fixture.payload.sections, (section) => section.header)).toStrictEqual([
        null,
        "answer",
        "completed"
      ])
      expect(parsed).toStrictEqual(fixture.payload.parsed)
      expect(extractedAnswer).toBe(fixture.payload.parsed.answer)
      expect(Option.isSome(Record.get(extracted, "completed"))).toBe(true)
    }))
})
