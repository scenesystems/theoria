import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { DeepDiveSurfacePlaneValue } from "../../app/contracts/presentation/layout.js"
import {
  deepDiveSecondaryPanePercentAtom,
  deepDiveSourceExplorerVisibleAtom,
  setDeepDiveSecondaryPanePercentAtom,
  toggleDeepDiveSourceExplorerVisibleAtom
} from "../../app/web/atoms/layout/deep-dive-pane.js"
import {
  deepDiveFocusedSurfaceAtom,
  deepDiveProjectedSurfaceCountAtom,
  deepDiveSurfaceOrderAtom
} from "../../app/web/atoms/layout/deep-dive-projection-state.js"
import {
  hideDeepDiveProjectedSurfaceAtom,
  projectDeepDiveSurfaceAtom,
  reorderDeepDiveProjectedSurfaceAtom
} from "../../app/web/atoms/layout/deep-dive-surface-projection.js"
import { setDeepDiveWorkspaceWidthAtom } from "../../app/web/atoms/layout/deep-dive-viewport.js"
import { DeepDiveDiagnosticsPlaneValue, diagnosticsProjectionEnabled } from "../../app/web/state/surface/deep-dive.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const withDiagnostics = (surfaces: ReadonlyArray<string>): ReadonlyArray<string> =>
  diagnosticsProjectionEnabled
    ? [...surfaces, DeepDiveDiagnosticsPlaneValue]
    : surfaces

describe("Deep Dive Layout Atoms", () => {
  it.effect("defaults to a two-surface projection deck with source hidden and explorer visible", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      expect(registry.get(deepDiveSurfaceOrderAtom)).toEqual(
        diagnosticsProjectionEnabled
          ? ["stage", "evidence", "source", DeepDiveDiagnosticsPlaneValue]
          : ["stage", "evidence", "source"]
      )
      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(2)
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("stage")
      expect(registry.get(deepDiveSecondaryPanePercentAtom)).toBe(50)
      expect(registry.get(deepDiveSourceExplorerVisibleAtom)).toBe(true)
    }))

  it.effect("can project a hidden surface into the workspace and reorder it without losing focus", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      registry.set(setDeepDiveWorkspaceWidthAtom, 1500)

      registry.set(projectDeepDiveSurfaceAtom, { index: 1, surface: DeepDiveSurfacePlaneValue.Source })

      expect(registry.get(deepDiveSurfaceOrderAtom)).toEqual(withDiagnostics(["stage", "source", "evidence"]))
      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(3)
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("source")

      registry.set(reorderDeepDiveProjectedSurfaceAtom, { index: 0, surface: DeepDiveSurfacePlaneValue.Source })

      expect(registry.get(deepDiveSurfaceOrderAtom)).toEqual(withDiagnostics(["source", "stage", "evidence"]))
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("source")
    }))

  it.effect("can hide projected surfaces while preserving at least one active surface and explorer independence", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      registry.set(setDeepDiveWorkspaceWidthAtom, 1500)

      registry.set(projectDeepDiveSurfaceAtom, { index: 1, surface: DeepDiveSurfacePlaneValue.Source })
      registry.set(hideDeepDiveProjectedSurfaceAtom, DeepDiveSurfacePlaneValue.Source)

      expect(registry.get(deepDiveSurfaceOrderAtom)).toEqual(
        diagnosticsProjectionEnabled
          ? ["stage", "evidence", DeepDiveDiagnosticsPlaneValue, "source"]
          : ["stage", "evidence", "source"]
      )
      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(2)
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("evidence")

      registry.set(toggleDeepDiveSourceExplorerVisibleAtom, undefined)
      expect(registry.get(deepDiveSourceExplorerVisibleAtom)).toBe(false)

      registry.set(hideDeepDiveProjectedSurfaceAtom, DeepDiveSurfacePlaneValue.Stage)
      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(1)
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("evidence")

      registry.set(hideDeepDiveProjectedSurfaceAtom, DeepDiveSurfacePlaneValue.Evidence)
      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(1)
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("evidence")
    }))

  it.effect("replaces a visible slot when the field is already at the workspace limit", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      registry.set(setDeepDiveWorkspaceWidthAtom, 720)
      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(1)

      registry.set(projectDeepDiveSurfaceAtom, { surface: DeepDiveSurfacePlaneValue.Source })

      expect(registry.get(deepDiveSurfaceOrderAtom)).toEqual(withDiagnostics(["source", "stage", "evidence"]))
      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(1)
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("source")
    }))

  it.effect("clamps the field when workspace width drops below the required pane threshold", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      registry.set(setDeepDiveWorkspaceWidthAtom, 1500)
      registry.set(projectDeepDiveSurfaceAtom, { index: 1, surface: DeepDiveSurfacePlaneValue.Source })

      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(3)
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("source")

      registry.set(setDeepDiveWorkspaceWidthAtom, 720)

      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(1)
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("stage")
      expect(registry.get(deepDiveSurfaceOrderAtom)).toEqual(withDiagnostics(["stage", "source", "evidence"]))
    }))

  it.effect("projects a hidden surface into the focused visible slot when the tray is already full", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      registry.set(setDeepDiveWorkspaceWidthAtom, 1500)
      registry.set(projectDeepDiveSurfaceAtom, { index: 1, surface: DeepDiveSurfacePlaneValue.Source })

      expect(registry.get(deepDiveSurfaceOrderAtom)).toEqual(withDiagnostics(["stage", "source", "evidence"]))

      registry.set(projectDeepDiveSurfaceAtom, { index: 0, surface: DeepDiveSurfacePlaneValue.Evidence })

      expect(registry.get(deepDiveSurfaceOrderAtom)).toEqual(withDiagnostics(["evidence", "stage", "source"]))
      expect(registry.get(deepDiveProjectedSurfaceCountAtom)).toBe(3)
      expect(registry.get(deepDiveFocusedSurfaceAtom)).toBe("evidence")
    }))

  it.effect("keeps the third-pane divider independently resizable", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      registry.set(setDeepDiveSecondaryPanePercentAtom, 61)

      expect(registry.get(deepDiveSecondaryPanePercentAtom)).toBe(61)
    }))
})
