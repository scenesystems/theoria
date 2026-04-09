import { describe, expect, it } from "@effect/vitest"

import {
  clampedThreePanePrimaryPercent,
  clampedThreePaneSecondaryPercent,
  threePanePrimaryBounds,
  threePaneSecondaryBounds
} from "../../app/web/state/surface/deep-dive-workspace-layout.js"

describe("projection-workspace-layout", () => {
  it("keeps the first divider within three-pane desktop bounds", () => {
    expect(threePanePrimaryBounds).toEqual({ maxPercent: 52, minPercent: 24 })
    expect(clampedThreePanePrimaryPercent(10)).toBe(24)
    expect(clampedThreePanePrimaryPercent(70)).toBe(52)
  })

  it("derives the trailing divider bounds from the first divider width", () => {
    expect(threePaneSecondaryBounds(24)).toEqual({ maxPercent: 68, minPercent: 32 })
    expect(threePaneSecondaryBounds(52)).toEqual({ maxPercent: 50, minPercent: 50 })
  })

  it("clamps the trailing divider so the third pane cannot collapse into a sliver", () => {
    expect(clampedThreePaneSecondaryPercent({ primaryPercent: 24, secondaryPercent: 80 })).toBe(68)
    expect(clampedThreePaneSecondaryPercent({ primaryPercent: 52, secondaryPercent: 20 })).toBe(50)
  })
})
