// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Effect, Layer, Number as Num, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { minimumTouchTarget, placeMarkers, stageFor } from "../../app/contracts/demo/imagined-place-flow.js"
import { placeScenarioRecordings } from "../../app/contracts/imagined-place.js"

import {
  act,
  attribute,
  BrowserLive,
  count,
  eventually,
  goto,
  hasText,
  hidden,
  openPage,
  press,
  setViewport,
  tap,
  visible
} from "./browser.js"
import { drawn, searchSettlesWithin } from "./demo.js"
import { boxOf, discTouchTargets, drawnForColumn, scrollElementTo } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * Every disc on the stage is a touch target of at least 44 px, whatever the
 * drawing made of it: a numbered disc at 320 wide is 29 px across, and the
 * reach around it — invisible, part of the disc — makes up the rest. The
 * reach is the disc's, so a touch on it lands on the disc and not on a prose
 * line beside it or a neighbour: the drawing keeps touch targets from
 * overlapping as it keeps discs from overlapping.
 */
layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  (it) => {
    it.effect.prop("an open answer leaves the next disc touchable across valid arrangements", {
      width: Schema.Int.check(Schema.isBetween({ minimum: 240, maximum: 900 })),
      top: Schema.Finite.check(Schema.isBetween({ minimum: 0.04, maximum: 0.6 }))
    }, ({ top, width }) =>
      Effect.gen(function*() {
        const { page } = yield* openPage({ hasTouch: true, viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* drawn(page)
        const paper = page.locator("[data-place-stage='paper']")
        const discs = paper.locator("[data-place-marker]:not([data-place-marker-leaving])")
        const features = placeScenarioRecordings["unfinished-light"].composition.features
        const paperBox = yield* act(() => paper.evaluate(boxOf))
        // Exercise real geometry independently of which candidate the seeded optimizer keeps.
        // Scale the drawing to the phone paper, as a wider retained drawing is displayed there.
        yield* Effect.forEach(Arr.make({ width, top }, { width: 240, top: 0.04 }, { width: 900, top: 0.6 }), (sample) =>
          Effect.gen(function*() {
            const scale = Num.divideUnsafe(paperBox.width, sample.width)
            const markers = placeMarkers(
              features,
              Arr.map(features, () =>
                Option.none()),
              stageFor(sample.width),
              { edge: 0.7, swing: 0, phase: 0, turns: 1, step: 0.03, top: sample.top }
            )
            yield* Effect.forEach(markers, (marker, index) =>
              act(() =>
                discs.nth(index).evaluate(
                  (element, style) => element.setAttribute("style", style),
                  `translate: ${Num.multiply(Num.subtract(marker.x, marker.radius), scale)}px ${
                    Num.multiply(Num.subtract(marker.y, marker.radius), scale)
                  }px; width: ${Num.multiply(Num.multiply(marker.radius, 2), scale)}px; height: ${
                    Num.multiply(Num.multiply(marker.radius, 2), scale)
                  }px;`
                )
              ))
            yield* act(() => paper.evaluate(scrollElementTo, 0))
            yield* act(() => discs.first().tap())
            yield* visible(page.locator("[data-place-provenance]"))
            yield* attribute(page.locator("[data-place-provenance]"), "data-answer-placement", "free")
            const second = yield* act(() => discs.nth(1).evaluate(boxOf))
            const receivesTouch = yield* act(() =>
              discs.nth(1).evaluate(
                (element, point) => element.contains(element.ownerDocument.elementFromPoint(point.x, point.y)),
                {
                  x: Num.sum(second.left, Num.divideUnsafe(second.width, 2)),
                  y: Num.sum(second.top, Num.divideUnsafe(second.height, 2))
                }
              )
            )
            expect(receivesTouch, `width=${sample.width}, top=${sample.top}`).toBe(true)
            yield* press(page, "Escape")
            yield* hidden(page.locator("[data-place-provenance]"))
          }))
      }), { arbitrary: { runs: 3, maxShrinks: 0 } })

    it.effect("every disc answers to a touch 44 px across on the narrowest phones", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const paper = demo.locator("[data-place-stage='paper']")
        const discs = demo.locator("[data-place-marker]:not([data-place-marker-leaving])")

        yield* Effect.forEach(Arr.make(390, 320), (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 844 })
            // A narrower column shows the last drawing fitted while its own search runs; the promise is about the drawing made for it.
            yield* eventually(() => demo.evaluate(drawnForColumn), true, searchSettlesWithin)
            yield* act(() => paper.evaluate(scrollElementTo, 0))
            const targets = yield* act(() => discs.evaluateAll(discTouchTargets))
            const at = `at ${String(width)}px`
            expect(targets.length, at).toBeGreaterThan(0)
            Arr.forEach(targets, (target) => {
              const disc = `${at}: ${target.name} (${String(Math.round(target.width))} px)`
              expect(target.width, disc).toBeGreaterThanOrEqual(minimumTouchTarget)
              expect(target.height, disc).toBeGreaterThanOrEqual(minimumTouchTarget)
              expect(target.missed, `${disc} missed ${target.missed.join(", ")}`).toEqual([])
            })
          }))
        expect(yield* failures).toEqual([])
      }))

    it.effect("a finger on a disc's reach opens that disc's answer and no other, on a phone with a touchscreen", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ hasTouch: true, viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const paper = demo.locator("[data-place-stage='paper']")
        const discs = demo.locator("[data-place-marker]:not([data-place-marker-leaving])")
        const overlay = page.locator("[data-place-provenance]")
        const title = overlay.locator("[data-current]").getByRole("heading", { level: 3 })

        yield* act(() => paper.evaluate(scrollElementTo, 0))
        const targets = yield* act(() => discs.evaluateAll(discTouchTargets))
        expect(targets.length).toBeGreaterThan(0)

        // Each disc in turn: a touch 21 px left of its centre — on the reach, off the painted disc at
        // 390 wide — answers with that disc's own name, and Escape puts the answer away before the next.
        yield* Effect.forEach(
          Arr.zip(targets, Arr.range(0, targets.length - 1)),
          ([target, index]) =>
            Effect.gen(function*() {
              yield* tap(discs.nth(index), { x: target.disc.width / 2 - 21, y: target.disc.height / 2 })
              yield* visible(overlay)
              yield* hasText(title, target.name)
              yield* press(page, "Escape")
              yield* hidden(overlay)
            })
        )
        expect(yield* failures).toEqual([])
      }))

    it.effect("a finger presses as a pointer does: the same disc again closes, another disc takes the answer, a touch outside puts it away", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ hasTouch: true, viewport: { width: 390, height: 844 } })
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const paper = demo.locator("[data-place-stage='paper']")
        const discs = demo.locator("[data-place-marker]:not([data-place-marker-leaving])")
        const overlay = page.locator("[data-place-provenance]")
        const title = overlay.locator("[data-current]").getByRole("heading", { level: 3 })
        yield* act(() => paper.evaluate(scrollElementTo, 0))
        const targets = yield* act(() => discs.evaluateAll(discTouchTargets))
        const [first, second] = yield* Effect.fromOption(Option.all([Arr.get(targets, 0), Arr.get(targets, 1)]))
        const centre = (target: typeof first) => ({ x: target.disc.width / 2, y: target.disc.height / 2 })

        // Touched, a disc answers; touched again, its answer closes: a finger is not resting on it, it pressed.
        yield* tap(discs.first(), centre(first))
        yield* visible(overlay)
        yield* hasText(title, first.name)
        yield* attribute(discs.first(), "data-popup-open", "")
        yield* tap(discs.first(), centre(first))
        yield* hidden(overlay)
        yield* count(demo.locator("[data-provenance][data-popup-open]"), 0)

        // A second disc touched while the first answers takes the answer; one answer is open, and it is the second's.
        yield* tap(discs.first(), centre(first))
        yield* visible(overlay)
        yield* tap(discs.nth(1), centre(second))
        yield* hasText(title, second.name)
        yield* count(demo.locator("[data-provenance][data-popup-open]"), 1)
        yield* attribute(discs.nth(1), "data-popup-open", "")

        // A touch on nothing in particular — the demo's own heading — puts the answer away.
        yield* tap(demo.getByRole("heading", { level: 2 }).first(), { x: 4, y: 4 })
        yield* hidden(overlay)
        yield* count(demo.locator("[data-provenance][data-popup-open]"), 0)
        expect(yield* failures).toEqual([])
      }))
  }
)
