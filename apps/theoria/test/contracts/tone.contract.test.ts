import { describe, expect, it } from "@effect/vitest"
import * as Arr from "effect/Array"

import type { EntryId as CardId } from "../../app/contracts/id.js"
import { toneForCard } from "../../app/contracts/tone.js"

const knownIds: ReadonlyArray<CardId> = ["effect-text", "effect-search", "effect-math", "effect-dsp"]

describe("Theoria Tone Contracts", () => {
  it("maps every demo id to a tone", () => {
    const tones = Arr.map(knownIds, toneForCard)

    expect(tones).toEqual(["text", "search", "math", "dsp"])
  })
})
