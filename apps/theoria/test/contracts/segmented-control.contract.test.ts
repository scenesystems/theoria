import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { Tone } from "../../app/contracts/theme.js"
import {
  segmentedControlButtonClassName,
  segmentedControlRailClassName,
  toneClassesFor
} from "../../app/web/view/primitives/designSystem.js"

const words = (className: string): ReadonlyArray<string> => Arr.filter(Str.split(className, " "), Str.isNonEmpty)

/**
 * A segmented control promises one row of equal cells: the eye reads the
 * options as alternatives because they sit side by side. Stacking them at a
 * narrow width turns the rail into a list of buttons, so up to three cells
 * stay in one row at every width; only four cells fold to two rows on a phone.
 */
describe("Segmented control contract", () => {
  it.effect("two and three cells are one row at every width", () =>
    Effect.gen(function*() {
      expect(segmentedControlRailClassName(2)).toContain("grid-cols-2")
      expect(segmentedControlRailClassName(3)).toContain("grid-cols-3")
      expect(Str.includes("grid-cols-1")(segmentedControlRailClassName(3))).toBe(false)
      expect(Str.includes("sm:")(segmentedControlRailClassName(3))).toBe(false)
    }))

  it.effect("four cells fold to two rows only below the small breakpoint", () =>
    Effect.gen(function*() {
      const rail = segmentedControlRailClassName(4)
      expect(rail).toContain("grid-cols-2")
      expect(rail).toContain("sm:grid-cols-4")
    }))

  /**
   * The rail is the instrument, so a cell at rest under the pointer must firm
   * to the rung beyond it, solid — a glass of that rung over the rail is not
   * seen, and the paper would lift the cell above its chosen neighbour.
   */
  it.effect("a cell at rest firms to the hairline under the pointer and the strong hairline pressed, never to the paper", () =>
    Effect.gen(function*() {
      Arr.forEach(Tone.literals, (tone) => {
        const cell = words(segmentedControlButtonClassName({ active: false, tone: toneClassesFor(tone) }))
        expect(cell, tone).toContain("hover:bg-hairline")
        expect(cell, tone).toContain("active:bg-hairline-strong")
        expect(Arr.some(cell, Str.includes("bg-paper")), tone).toBe(false)
        expect(Arr.some(cell, Str.includes("-glass")), tone).toBe(false)
      })
    }))
})
