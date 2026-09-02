import { describe, expect, it } from "@effect/vitest"
import { Option } from "effect"
import * as Arr from "effect/Array"

import { type Meander, meanderBounds, placeMarkers, stageFor } from "../../app/contracts/demo/imagined-place-flow.js"
import type { ParticipantRole, PlaceFeature } from "../../app/contracts/imagined-place.js"

const features: ReadonlyArray<PlaceFeature> = Arr.makeBy(6, (index) => ({
  name: `Feature ${String(index + 1)}`,
  description: "A feature.",
  weight: index % 2 === 0 ? 1 : 0.2
}))

const noContributors = Arr.map(features, () => Option.none())

/** The corners of the meander space are where the geometry is most stressed. */
const corner = (pick: 0 | 1): Meander => ({
  edge: meanderBounds.edge[pick],
  swing: meanderBounds.swing[pick],
  phase: meanderBounds.phase[pick],
  turns: meanderBounds.turns[pick],
  top: meanderBounds.top[pick],
  step: meanderBounds.step[0]
})

const corners: ReadonlyArray<Meander> = [corner(0), corner(1)]

describe("Imagined place geometry contract", () => {
  it("markers never overlap and never leave the padded stage, whatever the meander", () => {
    Arr.forEach([280, 640, 900], (width) => {
      const stage = stageFor(width)
      Arr.forEach(corners, (meander) => {
        const markers = placeMarkers(features, noContributors, stage, meander)
        expect(markers.length).toBe(features.length)

        Arr.forEach(markers, (m) => {
          expect(m.x - m.radius).toBeGreaterThanOrEqual(stage.padding - 1e-9)
          expect(m.x + m.radius).toBeLessThanOrEqual(stage.stageWidth - stage.padding + 1e-9)
          expect(m.y - m.radius).toBeGreaterThanOrEqual(stage.padding - 1e-9)
        })

        Arr.forEach(markers, (a, i) =>
          Arr.forEach(Arr.drop(markers, i + 1), (b) => {
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.radius + b.radius + 10 - 1e-9)
          }))
      })
    })
  })

  it("keeps the proposer on features that came from accepted proposals", () => {
    const contributors = Arr.map(
      features,
      (_, index) => (index === 5 ? Option.some<ParticipantRole>("neighbor") : Option.none())
    )
    const markers = placeMarkers(features, contributors, stageFor(640), corner(0))
    expect(Arr.filter(markers, (m) => m.contributedBy === "neighbor").length).toBe(1)
  })
})
