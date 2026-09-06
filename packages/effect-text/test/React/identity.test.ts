import { describe, expect, it } from "@effect/vitest"
import { Equal, Hash, HashMap, Option } from "effect"

import * as Browser from "../../src/Browser/index.js"
import * as TextReact from "../../src/React/index.js"
import type * as Text from "../../src/Text/index.js"

const profile = Browser.DefaultBrowserSupportProfile

const identityFor = (prepare: Text.PrepareInputType, fontReadinessRevision = 0) =>
  TextReact.prepareIdentityFor({
    prepare,
    engineProfile: profile.engineProfile,
    supportProfileId: profile.id,
    fontReadinessRevision
  })

describe("React preparation identities", () => {
  it("equal preparation inputs produce identities that are equal and hash alike", () => {
    const prepare: Text.PrepareInputType = {
      text: "Structural identity",
      font: { family: "serif", size: 18 },
      whiteSpace: "normal"
    }

    const first = identityFor(prepare)
    const second = identityFor({ ...prepare, font: { ...prepare.font } })

    expect(Equal.equals(first, second)).toBe(true)
    expect(Hash.hash(first)).toBe(Hash.hash(second))
    expect(HashMap.get(HashMap.make([first, "prepared"]), second)).toEqual(Option.some("prepared"))
  })

  it("a font-readiness revision, weight, or locale change produces a different identity", () => {
    const prepare: Text.PrepareInputType = {
      text: "Structural identity",
      font: { family: "serif", size: 18 },
      whiteSpace: "normal"
    }
    const base = identityFor(prepare)

    expect(Equal.equals(base, identityFor(prepare, 1))).toBe(false)
    expect(Equal.equals(base, identityFor({ ...prepare, font: { ...prepare.font, weight: 400 } }))).toBe(false)
    expect(Equal.equals(base, identityFor({ ...prepare, hyphenationLocale: "en-us" }))).toBe(false)
  })

  it("recovers the preparation input, keeping omitted fields omitted", () => {
    const minimal: Text.PrepareInputType = {
      text: "Round trip \uD800 with a lone surrogate",
      font: { family: "monospace", size: 14 },
      whiteSpace: "pre-wrap"
    }
    const complete: Text.PrepareInputType = {
      ...minimal,
      font: { ...minimal.font, weight: 600 },
      hyphenationLocale: "en-us"
    }

    expect(TextReact.prepareInputFromIdentity(identityFor(minimal))).toStrictEqual(minimal)
    expect(TextReact.prepareInputFromIdentity(identityFor(complete))).toStrictEqual(complete)
  })
})
