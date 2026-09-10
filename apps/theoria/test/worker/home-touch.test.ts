// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { minimumTouchTarget } from "../../app/contracts/demo/imagined-place-flow.js"

import {
  act,
  BrowserLive,
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
import { discTouchTargets, drawnForColumn, scrollElementTo } from "./platform/in-page.js"
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
    it.scoped("every disc answers to a touch 44 px across on the narrowest phones", () =>
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

    it.scoped("a finger on a disc's reach opens that disc's answer and no other, on a phone with a touchscreen", () =>
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
  }
)
