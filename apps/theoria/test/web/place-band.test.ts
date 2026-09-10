import { describe, expect, it } from "@effect/vitest"
import { Effect, Match } from "effect"
import * as Arr from "effect/Array"

import { ParticipantRole } from "../../app/contracts/imagined-place.js"
import { PlaceDiscDrawn } from "../../app/web/atoms/imagined-place-render.js"
import { bandDiscClassName, bandDiscPlacing, bandLabel, bandRow } from "../../app/web/view/home/placeViewModel.js"
import { departed, shiftTransition } from "../../app/web/view/primitives/motion.js"
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

  /**
   * The strip is one link; its drawing is decoration to assistive technology.
   * So the link's name says what the drawing shows — the place's features, in
   * the row's order — and not only where it goes.
   */
  it.effect("names itself from its row: where it goes, and the features it shows, in order", () =>
    Effect.gen(function*() {
      const { kept } = yield* onStage
      const row = bandRow(kept.projection)
      const names = Arr.map(row.discs, (disc) => disc.marker.name)
      expect(names.length).toBeGreaterThan(1)
      expect(bandLabel(row)).toBe(`Back to the place: ${Arr.join(names, ", ")}`)
      expect(bandLabel({ ...row, discs: [] })).toBe("Back to the place")
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

  /**
   * A disc already in the row moving over is something on the page shifting,
   * and takes the shift relation, not the arrival it fades in with. Under
   * reduced motion its centre is written as the attribute it is, so nothing
   * slides: Motion holds still only what it knows to.
   */
  it.effect("a disc slides over at the shift relation, and under reduced motion is placed outright", () =>
    Effect.sync(() => {
      expect(bandDiscPlacing("full", 120)).toEqual({
        initial: { cx: 120, opacity: 0 },
        animate: { cx: 120, opacity: 1 },
        transition: { cx: shiftTransition }
      })
      expect(bandDiscPlacing("reduced", 120)).toEqual({
        cx: "120.0",
        initial: departed,
        animate: { opacity: 1 }
      })
    }))

  /**
   * The strip and the discs' fills are near neighbours in both themes, so a
   * settled disc is bounded by a stroke in its contributor's 500 stop — the
   * boundary is what must stand out (WCAG 1.4.11) — and focus deepens that
   * ring rather than being the only one.
   */
  it.effect("a settled disc is bounded by its contributor's ring, and focus deepens it", () =>
    Effect.sync(() => {
      Arr.forEach(ParticipantRole.literals, (role) => {
        const tone = Match.value(role).pipe(
          Match.when("author", () => "sign"),
          Match.when("neighbor", () => "seal"),
          Match.when("program", () => "dsp"),
          Match.exhaustive
        )
        Arr.forEach(Arr.filter(PlaceDiscDrawn.literals, (drawn) => drawn !== "arriving"), (drawn) => {
          const resting = bandDiscClassName(role, drawn, false)
          const focused = bandDiscClassName(role, drawn, true)
          expect(resting).toContain(`fill-tone-${tone}-300`)
          expect(resting).toContain(`stroke-tone-${tone}-500`)
          expect(resting).not.toContain("stroke-transparent")
          expect(focused).toContain(`stroke-tone-${tone}-700`)
          expect(focused).toContain("stroke-[3]")
        })
      })
    }))
})
