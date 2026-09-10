import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { stageMaxWidth, stageMinWidth } from "../../app/contracts/demo/imagined-place-flow.js"
import {
  placeStageContainerWidthAtom,
  placeStageFrameBorderPx,
  placeStageFrameWidthAtom,
  placeStageMaxDrawableAtom,
  placeStageMeasuredWidthAtom,
  placeStagePresets,
  placeStageRequestAtom,
  placeStageWidthAtom
} from "../../app/web/atoms/imagined-place.js"

/**
 * The stage is as wide as its column allows, and the column's width is a
 * measurement: until the resize observer has reported one, the width is not
 * known, and nothing is cut or drawn for a width that was guessed. The presets
 * still offer every width until then, so the controls do not flicker.
 */

describe("the stage's width", () => {
  it.effect("is not known before the column is measured, and the widest is offered", () =>
    Effect.sync(() => {
      const registry = Registry.make()
      expect(registry.get(placeStageContainerWidthAtom)).toEqual(Option.none())
      expect(registry.get(placeStageMeasuredWidthAtom)).toEqual(Option.none())
      expect(registry.get(placeStageMaxDrawableAtom)).toBe(stageMaxWidth)
    }))

  it.effect("before the column is measured, the frame is the request cut to the column by the browser", () =>
    Effect.sync(() => {
      const registry = Registry.make()
      expect(registry.get(placeStageFrameWidthAtom)).toBe(
        `min(100%, ${String(stageMaxWidth + placeStageFrameBorderPx * 2)}px)`
      )
      const narrowest = placeStagePresets[0] ?? stageMinWidth
      registry.set(placeStageRequestAtom, narrowest)
      expect(registry.get(placeStageFrameWidthAtom)).toBe(
        `min(100%, ${String(narrowest + placeStageFrameBorderPx * 2)}px)`
      )
    }))

  it.effect("once measured, is the request cut to the column and clamped to the stage's range", () =>
    Effect.sync(() => {
      const registry = Registry.make()
      registry.set(placeStageContainerWidthAtom, Option.some(390))
      expect(registry.get(placeStageMaxDrawableAtom)).toBe(390)
      expect(registry.get(placeStageMeasuredWidthAtom)).toEqual(Option.some(registry.get(placeStageWidthAtom)))
      expect(registry.get(placeStageWidthAtom)).toBeLessThanOrEqual(390)

      registry.set(placeStageContainerWidthAtom, Option.some(stageMaxWidth + 400))
      expect(registry.get(placeStageMaxDrawableAtom)).toBe(stageMaxWidth)
      registry.set(placeStageContainerWidthAtom, Option.some(stageMinWidth - 100))
      expect(registry.get(placeStageMaxDrawableAtom)).toBe(stageMinWidth)

      registry.set(placeStageContainerWidthAtom, Option.some(stageMaxWidth))
      const narrowest = placeStagePresets[0] ?? stageMinWidth
      registry.set(placeStageRequestAtom, narrowest)
      expect(registry.get(placeStageMeasuredWidthAtom)).toEqual(Option.some(narrowest))
    }))
})
