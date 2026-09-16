/**
 * Text wire decoding retains the original Struct's property contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema, Tuple } from "effect"
import { parseTextOutput } from "../../src/internal/parse/decode.js"

describe("parser wire property contracts", () => {
  it.effect("retains excess markers for the Struct's excess-property errors", () =>
    Effect.gen(function*() {
      const schema = Schema.Struct({ result: Schema.Struct({ count: Schema.NumberFromString }) }).annotations({
        parseOptions: { onExcessProperty: "error" }
      })
      const rawOutput = "[[ ## result ## ]]\n{\"count\":\"7\"}\n[[ ## extra ## ]]\nnot declared"
      const error = yield* parseTextOutput("strict-wire", schema, rawOutput).pipe(Effect.flip)
      expect(error.rawOutput).toEqual(Option.some(rawOutput))
      expect(Arr.map(error.fieldDiagnostics, (diagnostic) => Tuple.make(diagnostic.field, diagnostic.issue))).toEqual(
        Arr.make(Tuple.make("extra", "unexpected-field"), Tuple.make("extra", "decode-error"))
      )
    }))

  it.effect("decodes renamed encoded keys and keeps omitted exact optional fields absent", () =>
    Effect.gen(function*() {
      const schema = Schema.Struct({
        result: Schema.propertySignature(Schema.Struct({ count: Schema.NumberFromString })).pipe(
          Schema.fromKey("wire")
        ),
        optional: Schema.optionalWith(Schema.Number, { exact: true })
      })
      expect(yield* parseTextOutput("structured-output", schema, "[[ ## wire ## ]]\n{\"count\":\"7\"}")).toEqual({
        result: { count: 7 }
      })
    }))
})
