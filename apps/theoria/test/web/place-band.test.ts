import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { bandRow } from "../../app/web/view/home/placeViewModel.js"
import { onStage } from "../helpers/place-on-stage.js"

/**
 * The band is the place as a strip: its discs in one row, in the order the
 * place names them, on paper no thicker than the discs need. It is read from
 * a real rendering, so the row is checked against the place itself.
 */
describe("place band", () => {
  it.effect("sets every disc of the place in one row, in order, none touching", () =>
    Effect.gen(function*() {
      const { kept } = yield* onStage
      const row = bandRow(kept.projection)
      expect(Arr.map(row.discs, (disc) => disc.marker.name)).toEqual(
        Arr.map(kept.projection.markers, (marker) => marker.name)
      )
      const edges = Arr.map(row.discs, (disc) => ({
        left: disc.cx - disc.marker.radius,
        right: disc.cx + disc.marker.radius
      }))
      Arr.forEach(Arr.zip(edges, Arr.drop(edges, 1)), ([before, after]) => {
        expect(after.left).toBeGreaterThan(before.right)
      })
      // The row's paper holds every disc, with paper to spare at both ends.
      Arr.forEach(edges, (edge) => {
        expect(edge.left).toBeGreaterThan(0)
        expect(edge.right).toBeLessThan(row.width)
      })
    }))

  it.effect("is a strip: its paper is no thicker than a quarter of the tallest disc, above and below", () =>
    Effect.gen(function*() {
      const { kept } = yield* onStage
      const row = bandRow(kept.projection)
      const tallest = Arr.reduce(kept.projection.markers, 0, (widest, marker) => Math.max(widest, marker.radius))
      expect(tallest).toBeGreaterThan(0)
      expect(row.cy).toBe(row.height / 2)
      expect(row.height).toBeLessThanOrEqual(tallest * 2 * 1.25)
      Arr.forEach(row.discs, (disc) => {
        expect(disc.cx).toBeGreaterThanOrEqual(disc.marker.radius)
      })
    }))
})
