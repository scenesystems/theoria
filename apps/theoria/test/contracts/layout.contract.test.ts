import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num, Option, Order } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { Elevation, elevationIndex, Measure, measureCss, Radius, radiusCss } from "../../app/contracts/layout.js"
import { motionEaseFor, MotionRelation } from "../../app/contracts/motion.js"
import { renderLayoutTokensCss } from "../../app/web/layout/layoutTokens.js"
import {
  elevationClassName,
  focusClassName,
  measureClassName,
  surfaceClassName,
  transitionClassName
} from "../../app/web/view/primitives/designSystem.js"

/** The app's `app/web` directory, from this file rather than the working directory: the root test run starts elsewhere. */
const webRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../app/web/", import.meta.url))
}).pipe(Effect.orDie)

const strictlyAscending = (values: ReadonlyArray<number>): boolean =>
  Arr.every(Arr.zip(values, Arr.drop(values, 1)), ([below, above]) => Order.lessThan(Num.Order)(below, above))

const remValue = (css: string): number => Option.getOrThrow(Num.parse(Str.replace("rem", "")(css)))

const words = (className: string): ReadonlyArray<string> => Arr.filter(Str.split(className, " "), Str.isNonEmpty)

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

  it.effect("composes every class from a token of the contract, never from Tailwind's own scale", () =>
    Effect.sync(() => {
      Arr.forEach(Elevation.literals, (elevation) => {
        expect(elevationClassName(elevation)).toBe(`z-(--th-z-${elevation})`)
      })
      Arr.forEach(Measure.literals, (measure) => {
        expect(measureClassName(measure)).toBe(`max-w-${measure}`)
      })
      Arr.forEach(MotionRelation.literals, (relation) => {
        expect(words(transitionClassName(relation))).toEqual([
          `duration-(--th-motion-duration-${relation})`,
          `ease-${motionEaseFor(relation)}`
        ])
      })
      // The drawer follows a finger, so it alone eases by the follow curve; everything else by the theme's.
      expect(transitionClassName("follow")).toContain("ease-follow")
      expect(transitionClassName("enter")).toContain("ease-theme")
      // The canvas is drawn by nothing; a sheet is the deepest paper; a drawer keeps the viewport's edge and no radius.
      expect(surfaceClassName("canvas")).toBe("")
      expect(words(surfaceClassName("sheet"))).toEqual(
        expect.arrayContaining(["rounded-sheet", "bg-paper", "shadow-hero"])
      )
      expect(surfaceClassName("drawer")).not.toMatch(/\brounded-/u)
      expect(words(surfaceClassName("drawer"))).toContain("border-r")
      // Focus is the neutral focus role for every control, whatever its tone.
      expect(words(focusClassName)).toEqual(
        expect.arrayContaining(["focus-visible:ring-2", "focus-visible:ring-focus"])
      )
    }))

  it.effect("the committed layout tokens equal the layout authority's rendering", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* webRoot
      const generated = yield* fileSystem.readFileString(path.join(root, "layout-tokens.generated.css"))

      expect(generated).toBe(renderLayoutTokensCss())
    }).pipe(Effect.provide(BunContext.layer)))
})
