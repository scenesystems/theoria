import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Record, Schema } from "effect"

import { parseTextOutput } from "../../src/internal/parse/decode.js"
import { extractMarkedRecord } from "../../src/internal/parse/protocol.js"
import { fixture } from "../kit/Fixtures.js"

const AnswerSchema = Schema.Struct({ answer: Schema.String })

describe("internal/parse DSPy contract parity", () => {
  it.effect("matches DSPy section extraction + parsed field contract", () =>
    Effect.gen(function*() {
      const reference = yield* fixture("chat-adapter-001", "upstream-kernel")
      const payload = yield* Schema.decodeUnknownEffect(Schema.Struct({
        completion: Schema.String,
        parsed: AnswerSchema
      }))(reference.payload)

      const parsed = yield* parseTextOutput("qa", AnswerSchema, payload.completion)
      const extracted = extractMarkedRecord(payload.completion)
      const extractedAnswer = Option.getOrElse(Record.get(extracted, "answer"), () => "")

      expect(parsed).toStrictEqual(payload.parsed)
      expect(extractedAnswer).toBe(payload.parsed.answer)
      expect(Option.isSome(Record.get(extracted, "completed"))).toBe(true)
    }))
})
