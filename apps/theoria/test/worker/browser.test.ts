// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Str from "effect/String"

import { act, addInitProbe, BrowserLive, evaluate, evaluateElement, goto, openPage, until } from "./browser.js"
import { drawn } from "./demo.js"
import { boxOf, recordedFootprints, recordFootprints } from "./platform/in-page.js"
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
