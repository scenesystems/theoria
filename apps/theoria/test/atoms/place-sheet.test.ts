import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { drawingScaled, PlaceDrawing } from "../../app/contracts/demo/imagined-place-flow.js"
import { PlaceSheet, sheetFit, sheetFitting } from "../../app/web/atoms/imagined-place-render.js"

/**
 * The sheet is never wider than the column: while the column is narrower than
 * the drawing on the stage, the drawing is shown fitted to the column — scaled
 * down as one piece, its paper with it — until the arrangement for the new
 * width lands. A column wider than the drawing does not scale it up: the
 * drawing keeps its size, centred, and the wider drawing arrives when it is
 * ready. What the next search carries on from is the drawing as it is shown,
 * so the discs travel from where they are seen to stand.
 */

const drawing = new PlaceDrawing({
  markers: [
    { name: "Causeway", description: "A causeway of set stones.", x: 500, y: 120, radius: 40 },
    {
      name: "The desk",
      description: "A single desk faces the sea.",
      x: 640,
      y: 260,
      radius: 50,
      contributedBy: "neighbor"
    }
  ],
  paper: 800
})

describe("the sheet under a drawing while the column changes width", () => {
  it.effect("fits a drawing wider than the column to the column, paper and all", () =>
    Effect.sync(() => {
      expect(sheetFit(448, 704)).toBeCloseTo(448 / 704, 10)
      expect(sheetFitting(448, 704, 800)).toEqual(
        PlaceSheet.make({ width: 448, height: 800 * (448 / 704), fit: 448 / 704 })
      )
    }))

  it.effect("never scales a drawing up: a wider column leaves the drawing its size", () =>
    Effect.sync(() => {
      expect(sheetFit(704, 448)).toBe(1)
      expect(sheetFitting(704, 448, 500)).toEqual(PlaceSheet.make({ width: 448, height: 500, fit: 1 }))
    }))

  it.effect("is the drawing's own while the column holds it", () =>
    Effect.sync(() => {
      expect(sheetFitting(704, 704, 500)).toEqual(PlaceSheet.make({ width: 704, height: 500, fit: 1 }))
    }))

  it.effect("scales a drawing as one piece: every disc's place and size, and the paper's edge", () =>
    Effect.sync(() => {
      const fitted = drawingScaled(drawing, 0.5)
      expect(fitted.paper).toBe(400)
      expect(fitted.markers).toEqual([
        { name: "Causeway", description: "A causeway of set stones.", x: 250, y: 60, radius: 20 },
        {
          name: "The desk",
          description: "A single desk faces the sea.",
          x: 320,
          y: 130,
          radius: 25,
          contributedBy: "neighbor"
        }
      ])
      expect(drawingScaled(drawing, 1)).toEqual(drawing)
    }))
})
