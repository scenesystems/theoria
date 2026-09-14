import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Str from "effect/String"

import { segmentedControlRailClassName } from "../../app/web/view/primitives/designSystem.js"

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
})
