import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"

import type { EntryId } from "../../../contracts/entry/id.js"
import {
  maxProjectedCount,
  type ProjectionModel,
  type ProjectionPlane,
  projectionSurfacesFromPlanes
} from "../../../contracts/presentation/projection.js"

import { modifySurface } from "./internal.js"
import { surfaceAtom } from "./state.js"

export const projectionPanelOpenAtom = Atom.make(false).pipe(Atom.keepAlive)

export const projectionPanePercentAtom = Atom.make(50).pipe(Atom.keepAlive)

export const setProjectionPanePercentAtom = Atom.fnSync<number>()(
  (percent, ctx) => {
    ctx.set(projectionPanePercentAtom, Math.max(20, Math.min(80, Math.round(percent))))
  }
)

export const toggleProjectionPanelAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(projectionPanelOpenAtom, !ctx(projectionPanelOpenAtom))
  }
)

export const projectionDragPlaneAtom = Atom.make<ProjectionPlane | null>(null).pipe(Atom.keepAlive)
export const projectionDragOverIndexAtom = Atom.make<number | null>(null).pipe(Atom.keepAlive)

export const startProjectionDragAtom = Atom.fnSync<ProjectionPlane>()(
  (plane, ctx) => {
    ctx.set(projectionDragPlaneAtom, plane)
    ctx.set(projectionDragOverIndexAtom, null)
  }
)

export const moveProjectionDragOverAtom = Atom.fnSync<number | null>()(
  (index, ctx) => {
    ctx.set(projectionDragOverIndexAtom, index)
  }
)

export const clearProjectionDragAtom = Atom.fnSync<void>()(
  (_, ctx) => {
    ctx.set(projectionDragPlaneAtom, null)
    ctx.set(projectionDragOverIndexAtom, null)
  }
)

export const surfaceProjectionModelAtom: (id: EntryId) => AtomType.Atom<ProjectionModel> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const state = get(surfaceAtom(id))

      return {
        surfaces: projectionSurfacesFromPlanes({
          projected: state.projectedSurfaces,
          focused: state.focusedSurface
        }),
        focusedSurface: state.focusedSurface,
        maxProjectedCount
      }
    })
)

type ProjectSurfaceInput = { readonly id: EntryId; readonly plane: ProjectionPlane; readonly index?: number }
type PlaneInput = { readonly id: EntryId; readonly plane: ProjectionPlane }
type ReorderInput = { readonly id: EntryId; readonly plane: ProjectionPlane; readonly index: number }

export const projectSurfaceAtom = Atom.fnSync<ProjectSurfaceInput>()(
  ({ id, plane, index }, ctx) => {
    modifySurface(ctx.registry, id, (surface) => {
      const currentIndex = surface.projectedSurfaces.indexOf(plane)
      const alreadyProjected = currentIndex >= 0

      if (alreadyProjected) {
        return surface
      }

      const insertIndex = index ?? (surface.projectedSurfaces.length >= maxProjectedCount
        ? maxProjectedCount - 1
        : surface.projectedSurfaces.length)

      const base = surface.projectedSurfaces.filter((p) => p !== plane)
      const capped = base.length >= maxProjectedCount ? base.slice(0, maxProjectedCount - 1) : base
      const next = [...capped.slice(0, insertIndex), plane, ...capped.slice(insertIndex)]

      return { ...surface, projectedSurfaces: next, focusedSurface: plane }
    })
  }
)

export const hideSurfaceAtom = Atom.fnSync<PlaneInput>()(
  ({ id, plane }, ctx) => {
    modifySurface(ctx.registry, id, (surface) => {
      const next = surface.projectedSurfaces.filter((p) => p !== plane)

      if (next.length === 0) {
        return surface
      }

      const focused = surface.focusedSurface === plane
        ? (next[0] ?? surface.focusedSurface)
        : surface.focusedSurface

      return { ...surface, projectedSurfaces: next, focusedSurface: focused }
    })
  }
)

export const focusSurfaceAtom = Atom.fnSync<PlaneInput>()(
  ({ id, plane }, ctx) => {
    modifySurface(ctx.registry, id, (surface) => {
      if (!surface.projectedSurfaces.includes(plane)) {
        return surface
      }

      return { ...surface, focusedSurface: plane }
    })
  }
)

export const reorderSurfaceAtom = Atom.fnSync<ReorderInput>()(
  ({ id, plane, index }, ctx) => {
    modifySurface(ctx.registry, id, (surface) => {
      const without = surface.projectedSurfaces.filter((p) => p !== plane)
      const clampedIndex = Math.max(0, Math.min(without.length, index))
      const next = [...without.slice(0, clampedIndex), plane, ...without.slice(clampedIndex)]

      return { ...surface, projectedSurfaces: next, focusedSurface: plane }
    })
  }
)
