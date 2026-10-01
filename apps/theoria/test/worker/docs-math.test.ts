// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Array, Effect, Layer } from "effect"

import { ColorMode } from "../../app/contracts/palette.js"
import {
  act,
  BrowserLive,
  count,
  desktop,
  fitsViewport,
  goto,
  openPage,
  phone,
  setColorScheme,
  setViewport,
  visible
} from "./browser.js"
import { recordedPolicyViolations, recordPolicyViolations } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "mathematical guides in Chromium",
  (it) => {
    it.scoped("renders real guide equations without CSP violations or page overflow in both themes and sizes", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ reducedMotion: "reduce" })
        yield* act(() => page.addInitScript(recordPolicyViolations))
        yield* goto(page, "/docs/effect-math/mathematical-conventions")
        yield* visible(page.getByRole("heading", { level: 1, name: "Mathematical conventions" }))

        yield* Effect.forEach(ColorMode.literals, (scheme) =>
          Effect.gen(function*() {
            yield* setColorScheme(page, scheme)
            yield* Effect.forEach(Array.make(desktop, phone), (viewport) =>
              Effect.gen(function*() {
                yield* setViewport(page, viewport)
                const equations = page.locator("math[display='block']")
                yield* count(equations, 3)
                yield* visible(equations.first())
                yield* count(equations.nth(1).locator("mfrac"), 2)
                yield* count(equations.nth(1).locator("msqrt"), 1)
                yield* visible(page.locator("p math").first())
                expect(yield* fitsViewport(page)).toBe(true)
                expect(yield* act(() => page.evaluate(recordedPolicyViolations))).toBe("")
              }))
          }))

        expect(yield* failures).toEqual(Array.empty())
      }))
  }
)
