import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { DeepDiveFocusedPaneValue } from "../../app/contracts/layout.js"
import {
  deepDiveFocusedPaneAtom,
  deepDiveSourceExplorerVisibleAtom,
  deepDiveSourcePaneVisibleAtom,
  focusDeepDiveSourcePaneAtom,
  focusDeepDiveStagePaneAtom,
  hideDeepDiveSourcePaneAtom,
  showDeepDiveSourcePaneAtom,
  toggleDeepDiveSourceExplorerVisibleAtom
} from "../../app/web/atoms/deep-dive-layout.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

describe("Deep Dive Layout Atoms", () => {
  it.effect("defaults to visible source pane with stage focus and explorer visible", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      expect(registry.get(deepDiveSourcePaneVisibleAtom)).toBe(true)
      expect(registry.get(deepDiveFocusedPaneAtom)).toBe(DeepDiveFocusedPaneValue.Stage)
      expect(registry.get(deepDiveSourceExplorerVisibleAtom)).toBe(true)
    }))

  it.effect("hides the source pane globally without mutating explorer state", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      registry.set(hideDeepDiveSourcePaneAtom, undefined)
      expect(registry.get(deepDiveSourcePaneVisibleAtom)).toBe(false)
      expect(registry.get(deepDiveFocusedPaneAtom)).toBe(DeepDiveFocusedPaneValue.Stage)
      expect(registry.get(deepDiveSourceExplorerVisibleAtom)).toBe(true)

      registry.set(toggleDeepDiveSourceExplorerVisibleAtom, undefined)
      expect(registry.get(deepDiveSourcePaneVisibleAtom)).toBe(false)
      expect(registry.get(deepDiveSourceExplorerVisibleAtom)).toBe(false)
    }))

  it.effect("can focus source and stage independently while source visibility stays global", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      registry.set(toggleDeepDiveSourceExplorerVisibleAtom, undefined)
      registry.set(hideDeepDiveSourcePaneAtom, undefined)
      registry.set(showDeepDiveSourcePaneAtom, undefined)
      registry.set(focusDeepDiveSourcePaneAtom, undefined)

      expect(registry.get(deepDiveSourcePaneVisibleAtom)).toBe(true)
      expect(registry.get(deepDiveFocusedPaneAtom)).toBe(DeepDiveFocusedPaneValue.Source)
      expect(registry.get(deepDiveSourceExplorerVisibleAtom)).toBe(false)

      registry.set(focusDeepDiveStagePaneAtom, undefined)
      expect(registry.get(deepDiveSourcePaneVisibleAtom)).toBe(true)
      expect(registry.get(deepDiveFocusedPaneAtom)).toBe(DeepDiveFocusedPaneValue.Stage)
    }))
})
