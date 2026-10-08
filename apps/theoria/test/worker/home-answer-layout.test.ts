// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Boolean as Bool, Effect, Layer, Number as Num, String as Str } from "effect"
import * as Arr from "effect/Array"

import {
  act,
  attribute,
  BrowserLive,
  click,
  eventually,
  goto,
  hidden,
  openPage,
  press,
  setViewport,
  until,
  visible
} from "./browser.js"
import { drawn } from "./demo.js"
import { boxOf, scrollElementTo } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })((it) => {
  it.effect("a viewport with provably no readable free box still answers and dismisses", () =>
    Effect.gen(function*() {
      const { failures, page } = yield* openPage({ viewport: { width: 390, height: 180 }, hasTouch: true })
      yield* goto(page, "/")
      yield* drawn(page)
      const disc = page.locator("[data-place-marker]:not([data-place-marker-leaving])").first()
      const popup = page.locator("[data-place-provenance]")
      yield* act(() => disc.evaluate(scrollElementTo, 0.2))
      const obstacle = yield* act(() => disc.evaluate(boxOf))
      // At this width every possible 352px answer crosses this disc's x range.
      // Neither space above nor below it reaches the 96px minimum reading height.
      expect(obstacle.left).toBeLessThan(364)
      expect(obstacle.right).toBeGreaterThan(26)
      expect(Num.subtract(obstacle.top, 12)).toBeLessThan(96)
      expect(Num.subtract(168, obstacle.bottom)).toBeLessThan(96)
      yield* act(() => disc.tap())
      yield* visible(popup)
      yield* attribute(popup, "data-answer-placement", "fallback")
      const box = yield* act(() => popup.evaluate(boxOf))
      expect(box.top).toBeGreaterThanOrEqual(11.9)
      expect(box.bottom).toBeLessThanOrEqual(168.1)
      yield* press(page, "Escape")
      yield* hidden(popup)
      yield* act(() => disc.tap())
      yield* visible(popup)
      yield* act(() => page.touchscreen.tap(2, 2))
      yield* hidden(popup)
      expect(yield* failures).toEqual([])
    }))

  it.effect("an answer remains inside the viewport and clear of every disc through scroll, resize and edge placements", () =>
    Effect.gen(function*() {
      const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
      yield* goto(page, "/")
      yield* drawn(page)
      const disc = page.locator("[data-place-marker]:not([data-place-marker-leaving])").first()
      const popup = page.locator("[data-place-provenance]")
      yield* act(() => disc.evaluate(scrollElementTo, 0.1))
      yield* act(() => disc.tap())
      yield* visible(popup)
      yield* Effect.forEach([390, 1280], (width) =>
        Effect.gen(function*() {
          yield* setViewport(page, { width, height: 844 })
          yield* Effect.forEach([0.02, 0.5, 0.94], (share) =>
            Effect.gen(function*() {
              yield* act(() => disc.evaluate(scrollElementTo, share))
              const targets = page.locator("[data-place-marker]:not([data-place-marker-leaving]), [data-place-reach]")
              const clear = yield* until(
                Effect.gen(function*() {
                  const box = yield* act(() => popup.evaluate(boxOf))
                  const separation = yield* Effect.forEach(
                    Arr.range(0, Num.subtract(yield* act(() => targets.count()), 1)),
                    (index) =>
                      Effect.gen(function*() {
                        const target = yield* act(() => targets.nth(index).evaluate(boxOf))
                        return Bool.some([
                          box.right <= target.left,
                          box.left >= target.right,
                          box.bottom <= target.top,
                          box.top >= target.bottom
                        ])
                      })
                  )
                  return Bool.every([
                    box.left >= 11.9,
                    box.right <= Num.subtract(width, 11.9),
                    box.top >= 11.9,
                    box.bottom <= 832.1,
                    Bool.every(separation)
                  ])
                }),
                (clear) => clear,
                "answer inside viewport and clear of every disc after layout"
              )
              expect(clear).toBe(true)
              yield* attribute(popup, "data-answer-placement", "free")
            }))
        }))
      yield* press(page, "Escape")
      yield* hidden(popup)
      expect(yield* failures).toEqual([])
    }))

  it.effect("a long phone answer scrolls by touch, selects prose, and keeps its controls and keyboard focus", () =>
    Effect.gen(function*() {
      const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
      yield* goto(page, "/")
      yield* drawn(page)
      const disc = page.locator("[data-place-marker]:not([data-place-marker-leaving])").first()
      const popup = page.locator("[data-place-provenance]")
      yield* act(() => disc.evaluate(scrollElementTo, 0.05))
      yield* act(() => disc.focus())
      yield* press(page, "Enter")
      yield* visible(popup)
      yield* eventually(() => popup.evaluate((element) => element === element.ownerDocument.activeElement), true)
      const prose = popup.locator("[data-current] p").first()
      const long = Str.trim(
        Str.repeat(100)("A long answer still lets the reader select its words and follow its sources. ")
      )
      yield* act(() =>
        prose.evaluate((element, text) => {
          element.textContent = text
        }, long)
      )
      yield* until(act(() => popup.evaluate(boxOf)), (box) =>
        Bool.every([
          box.top >= 11.9,
          box.bottom <= 832.1,
          box.height >= 96
        ]), "long answer capped inside viewport")
      expect(yield* act(() => popup.evaluate((element) => element.scrollHeight > element.clientHeight))).toBe(true)
      expect(
        yield* act(() =>
          prose.evaluate((element) =>
            element.contains(element.ownerDocument.elementFromPoint(
              element.getBoundingClientRect().left + 8,
              element.getBoundingClientRect().top + 8
            ))
          )
        )
      ).toBe(true)
      yield* act(() =>
        prose.evaluate((element) => {
          const range = element.ownerDocument.createRange()
          range.selectNodeContents(element)
          element.ownerDocument.getSelection()?.removeAllRanges()
          element.ownerDocument.getSelection()?.addRange(range)
        })
      )
      expect(yield* act(() => prose.evaluate((element) => element.ownerDocument.getSelection()?.toString()))).toBe(long)
      yield* act(() => prose.evaluate((element) => element.ownerDocument.getSelection()?.removeAllRanges()))
      const cdp = yield* act(() => page.context().newCDPSession(page))
      const touchBox = yield* act(() => popup.evaluate(boxOf))
      const x = Num.sum(touchBox.left, 50)
      const y = Num.subtract(touchBox.bottom, 35)
      yield* act(() => cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }))
      yield* Effect.forEach(Arr.range(1, 10), (step) =>
        Effect.gen(function*() {
          yield* Effect.sleep("16 millis")
          yield* act(() =>
            cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x, y: Num.subtract(y, Num.multiply(step, 18)) }]
            })
          )
        }))
      yield* act(() => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }))
      yield* until(
        act(() => popup.evaluate((element) => element.scrollTop)),
        (top) => top > 0,
        "touch scroll advances the answer"
      )
      yield* act(() => cdp.detach())
      yield* press(page, "Tab")
      yield* until(
        act(() => popup.evaluate((element) => element.contains(element.ownerDocument.activeElement))),
        (inside) => inside,
        "Tab remains inside the answer"
      )
      // The source link at the end remains reachable inside the scrollport.
      const source = popup.getByRole("link", { name: /composer.forward/ })
      yield* click(source)
      yield* hidden(popup)
      expect(yield* failures).toEqual([])
    }))
})
