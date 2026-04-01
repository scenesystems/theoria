import { describe, expect, it } from "@effect/vitest"
import * as Arr from "effect/Array"

import { toneForCard } from "../../app/contracts/theme.js"

const knownIds = ["effect-text", "effect-search", "effect-math", "effect-dsp"]

describe("Theoria Theme Contracts", () => {
  it("maps every demo id to a tone", () => {
    const tones = Arr.map(knownIds, toneForCard)

    expect(tones).toEqual(["text", "search", "math", "dsp"])
  })
})
