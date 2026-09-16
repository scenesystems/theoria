import { describe, expect, it } from "@effect/vitest"
import { Effect, Equal, Hash, HashMap, Number, Option, Tuple } from "effect"
import * as Arr from "effect/Array"

import * as Browser from "../../src/Browser/index.js"
import * as TextReact from "../../src/React/index.js"
import type * as Text from "../../src/Text/index.js"

const profile = Browser.DefaultBrowserSupportProfile

const identityFor = (
  prepare: Text.PrepareInputType,
  fontReadinessRevision: Browser.FontReadinessRevisionType = Browser.initialFontReadinessRevision(),
  engineProfile: Text.EngineProfileType = profile.engineProfile,
  supportProfileId: Browser.BrowserSupportProfileIdType = profile.id
) =>
  TextReact.prepareIdentityFor({
    prepare,
    engineProfile,
    supportProfileId,
    fontReadinessRevision
  })

const minimalPrepare: Text.PrepareInputType = {
  text: "Structural identity",
  font: { family: "serif", size: 18 },
  whiteSpace: "normal"
}

const layoutLine = (index: number, text: string, width: number): Text.LayoutLineType => ({
  baseDirection: "ltr",
  index,
  order: "visual",
  text,
  width
})

describe("React preparation identities", () => {
  it.effect("equal inputs produce structural identities usable as hash keys", () =>
    Effect.gen(function*() {
      const first = identityFor(minimalPrepare)
      const second = identityFor({
        text: minimalPrepare.text,
        font: { family: minimalPrepare.font.family, size: minimalPrepare.font.size },
        whiteSpace: minimalPrepare.whiteSpace
      })

      expect(Equal.equals(first, second)).toBe(true)
      expect(Hash.hash(first)).toBe(Hash.hash(second))
      expect(HashMap.get(HashMap.make(Tuple.make(first, "prepared")), second)).toEqual(Option.some("prepared"))
    }))

  it.effect("omission, locale, profile, engine, and revision participate in identity", () =>
    Effect.gen(function*() {
      const base = identityFor(minimalPrepare)
      const explicitWeight = identityFor({
        text: minimalPrepare.text,
        font: { family: minimalPrepare.font.family, size: minimalPrepare.font.size, weight: 400 },
        whiteSpace: minimalPrepare.whiteSpace
      })
      const locale = identityFor({
        text: minimalPrepare.text,
        font: minimalPrepare.font,
        whiteSpace: minimalPrepare.whiteSpace,
        hyphenationLocale: "en-us"
      })
      const changedEngine: Text.EngineProfileType = {
        lineFitEpsilon: Number.sum(profile.engineProfile.lineFitEpsilon, 0.01),
        tabWidth: profile.engineProfile.tabWidth,
        defaultDirection: profile.engineProfile.defaultDirection,
        preferEarlySoftHyphenBreak: profile.engineProfile.preferEarlySoftHyphenBreak,
        preferPrefixWidthsForBreakableRuns: profile.engineProfile.preferPrefixWidthsForBreakableRuns
      }

      expect(Equal.equals(base, explicitWeight)).toBe(false)
      expect(Equal.equals(base, locale)).toBe(false)
      expect(Equal.equals(base, identityFor(minimalPrepare, Browser.incrementFontReadinessRevision(0)))).toBe(false)
      expect(Equal.equals(base, identityFor(minimalPrepare, 0, changedEngine))).toBe(false)
      expect(Equal.equals(base, identityFor(minimalPrepare, 0, profile.engineProfile, "canvas-system-ui"))).toBe(false)
    }))

  it.effect("recovers preparation input while retaining optional-field omission", () =>
    Effect.gen(function*() {
      const minimal: Text.PrepareInputType = {
        text: "Round trip \uD800 with a lone surrogate",
        font: { family: "monospace", size: 14 },
        whiteSpace: "pre-wrap"
      }
      const complete: Text.PrepareInputType = {
        text: minimal.text,
        font: { family: minimal.font.family, size: minimal.font.size, weight: 600 },
        whiteSpace: minimal.whiteSpace,
        hyphenationLocale: "en-us"
      }

      expect(TextReact.prepareInputFromIdentity(identityFor(minimal))).toStrictEqual(minimal)
      expect(TextReact.prepareInputFromIdentity(identityFor(complete))).toStrictEqual(complete)
    }))

  it.effect("derives projection summary arithmetic from painted lines", () =>
    Effect.gen(function*() {
      const summary = TextReact.layoutSummaryFromLines(
        Arr.make(layoutLine(0, "a", 12), layoutLine(1, "bb", 20)),
        14
      )

      expect(summary).toStrictEqual({ lineCount: 2, height: 28, maxLineWidth: 20 })
    }))
})
