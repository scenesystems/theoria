import { describe, expect, it } from "@effect/vitest"
import { Effect, Equal, Hash, HashMap, Number, Option, Tuple } from "effect"

import * as CanvasProfile from "../../src/CanvasProfile.js"
import * as PreparationKey from "../../src/PreparationKey.js"
import * as Text from "../../src/Text.js"

const profile = CanvasProfile.monospace
const minimal: Text.Input = {
  text: "Structural identity",
  font: { family: "serif", size: 18 },
  whiteSpace: "normal"
}

const keyFor = (
  prepare: Text.Input,
  revision: PreparationKey.Revision = PreparationKey.initialRevision,
  engineProfile: Text.Profile = profile.engineProfile,
  supportProfileId: CanvasProfile.Id = profile.id
) =>
  PreparationKey.make(
    new PreparationKey.Options({
      prepare,
      engineProfile,
      supportProfileId,
      fontReadinessRevision: revision
    })
  )

describe("PreparationKey", () => {
  it.effect("is structural and usable as a HashMap key", () =>
    Effect.gen(function*() {
      const first = keyFor(minimal)
      const second = keyFor(
        {
          text: minimal.text,
          font: { family: minimal.font.family, size: minimal.font.size },
          whiteSpace: minimal.whiteSpace
        },
        PreparationKey.initialRevision,
        Text.Profile.make({ ...profile.engineProfile })
      )

      expect(Equal.equals(first, second)).toBe(true)
      expect(Hash.hash(first)).toBe(Hash.hash(second))
      expect(HashMap.get(HashMap.make(Tuple.make(first, "prepared")), second)).toEqual(Option.some("prepared"))
    }))

  it.effect("distinguishes omission, locale, profile, engine settings, and revision", () =>
    Effect.gen(function*() {
      const base = keyFor(minimal)
      const explicitWeight = keyFor({ ...minimal, font: { ...minimal.font, weight: 400 } })
      const locale = keyFor({ ...minimal, hyphenationLocale: "en-us" })
      const changedEngine = Text.Profile.make({
        ...profile.engineProfile,
        lineFitEpsilon: Number.sum(profile.engineProfile.lineFitEpsilon, 0.01)
      })

      expect(Equal.equals(base, explicitWeight)).toBe(false)
      expect(Equal.equals(base, locale)).toBe(false)
      expect(Equal.equals(base, keyFor(minimal, PreparationKey.nextRevision(PreparationKey.initialRevision))))
        .toBe(false)
      expect(Equal.equals(base, keyFor(minimal, PreparationKey.initialRevision, changedEngine))).toBe(false)
      expect(
        Equal.equals(
          base,
          keyFor(minimal, PreparationKey.initialRevision, profile.engineProfile, CanvasProfile.systemUi.id)
        )
      )
        .toBe(false)
    }))

  it.effect("recovers canonical input while retaining optional-field omission", () =>
    Effect.gen(function*() {
      const complete: Text.Input = {
        ...minimal,
        font: { ...minimal.font, weight: 600 },
        hyphenationLocale: "en-us"
      }

      expect(PreparationKey.toInput(keyFor(minimal))).toStrictEqual(minimal)
      expect(PreparationKey.toInput(keyFor(complete))).toStrictEqual(complete)
    }))
})
