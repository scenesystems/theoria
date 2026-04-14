import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"

import { CardTone } from "../../app/contracts/tone.js"

const knownTones: ReadonlyArray<string> = ["text", "search", "math", "dsp", "digest", "sign", "seal"]

describe("Theoria Tone Contracts", () => {
  it("publishes the canonical card-tone literals", () => {
    expect(knownTones.every((tone) => Schema.is(CardTone)(tone))).toBe(true)
    expect(Schema.is(CardTone)("workflow")).toBe(false)
  })
})
