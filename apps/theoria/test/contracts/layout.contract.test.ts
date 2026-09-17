import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num, Option, Order } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { Elevation, elevationIndex, measureCss, Radius, radiusCss } from "../../app/contracts/layout.js"

const strictlyAscending = (values: ReadonlyArray<number>): boolean =>
  Arr.every(Arr.zip(values, Arr.drop(values, 1)), ([below, above]) => Order.lessThan(Num.Order)(below, above))

const remValue = (css: string): number => Option.getOrThrow(Num.parse(Str.replace("rem", "")(css)))

describe("layout contract", () => {
  it.effect("stacks the elevations in the order the literal names them, each above the last", () =>
    Effect.sync(() => {
      const indices = Arr.map(Elevation.literals, elevationIndex)
      expect(strictlyAscending(indices)).toBe(true)
      // A backdrop dims what is under a sheet, so it stands over the header and under the sheet;
      // a menu may be opened from inside a sheet, so it stands over the sheet.
      expect(elevationIndex("header")).toBeLessThan(elevationIndex("backdrop"))
      expect(elevationIndex("backdrop")).toBeLessThan(elevationIndex("sheet"))
      expect(elevationIndex("sheet")).toBeLessThan(elevationIndex("menu"))
      // An answer to a mark stands over the band that holds the marks; a link's preview over both.
      expect(elevationIndex("band")).toBeLessThan(elevationIndex("answer"))
      expect(elevationIndex("answer")).toBeLessThan(elevationIndex("preview"))
    }))

  it.effect("grows corners from controls to sheets and keeps reading narrower than either page shell", () =>
    Effect.sync(() => {
      expect(strictlyAscending(Arr.map(Radius.literals, (radius) => remValue(radiusCss(radius))))).toBe(true)
      expect(remValue(measureCss("reading"))).toBeLessThan(remValue(measureCss("page")))
      expect(remValue(measureCss("reading"))).toBeLessThan(remValue(measureCss("workbench")))
      expect(radiusCss("control")).toBe("0.5rem")
      expect(measureCss("reading")).toBe("54rem")
    }))
})
