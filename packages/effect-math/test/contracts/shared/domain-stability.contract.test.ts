import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Schema } from "effect"

import { DomainStability } from "../../../src/contracts/shared/DomainStability.js"
import { GeometryDomainModel } from "../../../src/Geometry/model.js"

describe("shared domain stability contracts", () => {
  it.effect("accepts the three canonical stability levels", () =>
    Effect.gen(function*() {
      expect(yield* Schema.decodeUnknown(DomainStability)("stable")).toStrictEqual("stable")
      expect(yield* Schema.decodeUnknown(DomainStability)("provisional")).toStrictEqual("provisional")
      expect(yield* Schema.decodeUnknown(DomainStability)("experimental")).toStrictEqual("experimental")
    }))

  it.effect("rejects undeclared stability levels", () =>
    Effect.gen(function*() {
      const invalid = yield* Effect.either(Schema.decodeUnknown(DomainStability)("deprecated"))

      expect(
        Match.value(invalid).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
    }))

  it("keeps Geometry in stable tier for first-wave release obligations", () => {
    const geometryStability = Schema.decodeUnknownSync(DomainStability)(GeometryDomainModel.stability)

    expect(geometryStability).toStrictEqual("stable")
  })
})
