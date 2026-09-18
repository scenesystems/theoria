// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Str from "effect/String"

import {
  act,
  addInitProbe,
  BrowserLive,
  evaluate,
  evaluateElement,
  evaluateElements,
  goto,
  openPage,
  until
} from "./browser.js"
import { drawn } from "./demo.js"
import {
  beforeRuleCentreX,
  boxOf,
  edgesOf,
  finishingTouches,
  recordedFootprints,
  recordFootprints,
  textAreaVisibleRows,
  textBlockMetrics
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "dependency-preserving browser probes",
  (it) => {
    it.scoped("computes geometry with Effect dependencies in each document after navigation", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* act(() =>
          page.route("**/probe/*", (route) =>
            route.fulfill({
              contentType: "text/html",
              body: "<!doctype html><body style='margin:0'><div style='width:50vw;margin-left:20px;height:30px'></div>"
            }))
        )
        yield* goto(page, "/probe/first")
        expect(yield* evaluateElement(page.locator("div"), boxOf)).toMatchObject({ width: 640, centreX: 340 })

        yield* act(() => page.setViewportSize({ width: 900, height: 800 }))
        yield* goto(page, "/probe/second")
        expect(yield* evaluateElement(page.locator("div"), boxOf)).toMatchObject({ width: 450, centreX: 245 })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("decodes CSS numeric prefixes without turning CSS keywords into measurements", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* act(() =>
          page.route("**/probe/css-numbers", (route) =>
            route.fulfill({
              contentType: "text/html",
              body: `<!doctype html>
                <style>
                  body { margin: 0 }
                  #edges { width: 40px; height: 40px; outline: 2px solid; border-style: solid; border-width: 1px 2px 3px 4px }
                  #rule { position: relative; margin-left: 20px; width: 40px }
                  #rule::before { content: ""; position: absolute; left: -3.5px; width: 1.5px; height: 1px }
                  #normal { line-height: normal }
                  #rows { box-sizing: content-box; height: 31px; line-height: 15.5px; padding: 2.25px 0 3.75px; border-style: solid; border-width: 1px 0 2px }
                </style>
                <div id="edges"></div>
                <div id="rule"></div>
                <div id="normal">normal leading</div>
                <textarea id="rows"></textarea>
                <div data-place-walk><svg><mask><path stroke-dasharray=".625 2"></path></mask></svg></div>`
            }))
        )
        yield* goto(page, "/probe/css-numbers")

        expect(yield* evaluateElements(page.locator("#edges"), edgesOf)).toEqual([
          {
            outline: { color: "rgb(0, 0, 0)", style: "solid", width: 2 },
            border: { color: "rgb(0, 0, 0)", style: "solid", width: 4 }
          }
        ])
        expect(yield* evaluateElement(page.locator("#rule"), beforeRuleCentreX)).toBe(17.25)
        expect((yield* evaluate(page, finishingTouches)).walk).toBe(0.625)
        expect(yield* evaluateElement(page.locator("#rows"), textAreaVisibleRows)).toBe(2)
        expect((yield* evaluateElement(page.locator("#normal"), textBlockMetrics)).lineHeight).toBeNaN()
        expect(yield* failures).toEqual([])
      }))

    it.scoped("installs a dependency-bearing observer before the document loads", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* addInitProbe(page, recordFootprints)
        yield* goto(page, "/")
        yield* drawn(page)

        const reports = yield* until(
          evaluate(page, recordedFootprints),
          Str.includes("stage:column"),
          "the init-script observer collected stage geometry"
        )
        expect(reports).toContain("step:compose")
        expect(yield* failures).toEqual([])
      }))
  }
)
