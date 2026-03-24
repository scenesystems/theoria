import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Schema, String as EffectString } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../../../src/contracts/shared/BoundaryErrors.js"

describe("shared boundary error contracts", () => {
  it.effect("decodes canonical boundary decode and encode failures", () =>
    Effect.gen(function*() {
      const decodeError = yield* Schema.decodeUnknown(BoundaryDecodeError)({
        _tag: "BoundaryDecodeError",
        domain: "Numeric",
        contract: "NumericDomainSchema",
        message: "invalid boundary input"
      })
      const encodeError = yield* Schema.decodeUnknown(BoundaryEncodeError)({
        _tag: "BoundaryEncodeError",
        domain: "Statistics",
        contract: "StatisticsDomainSchema",
        message: "invalid boundary output"
      })

      expect(EffectString.Equivalence(decodeError._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(encodeError._tag, "BoundaryEncodeError")).toStrictEqual(true)
    }))

  it.effect("rejects malformed boundary error payloads", () =>
    Effect.gen(function*() {
      const malformedDecode = yield* Effect.either(
        Schema.decodeUnknown(BoundaryDecodeError)({
          _tag: "BoundaryDecodeError",
          domain: "Numeric",
          contract: "NumericDomainSchema"
        })
      )
      const malformedEncode = yield* Effect.either(
        Schema.decodeUnknown(BoundaryEncodeError)({
          _tag: "BoundaryEncodeError",
          domain: "Statistics",
          contract: "StatisticsDomainSchema"
        })
      )

      expect(
        Match.value(malformedDecode).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
      expect(
        Match.value(malformedEncode).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
    }))
})
