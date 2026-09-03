// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Clock, Deferred, Effect, Layer, Runtime } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { cards } from "../../app/contracts/card.js"
import {
  act,
  attribute,
  BrowserLive,
  click,
  containsText,
  count,
  fill,
  fitsViewport,
  goto,
  hidden,
  observeRequests,
  openPage,
  setViewport,
  someCount,
  urlMatches,
  visible
} from "./browser.js"
import { SiteLive } from "./site.js"

const codeTokens = "[class~=\"text-code-keyword\"], [class~=\"text-code-type\"]"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria docs in Chromium",
  (it) => {
    it.scoped("landing links enter the package documentation without a reload", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        const documents = yield* observeRequests(page, (request) => request.resourceType === "document")

        yield* goto(page, "/")
        yield* visible(
          page.getByRole("heading", { level: 1, name: "Scientific computing and model programming with Effect" })
        )
        yield* visible(page.getByRole("region", { name: "Imagined place demo" }))
        yield* attribute(page.getByRole("link", { exact: true, name: "Browse the packages" }), "href", "/docs")

        const headerNavigationStarted = yield* Clock.currentTimeMillis
        yield* click(page.locator("header").getByRole("link", { exact: true, name: "Docs" }))
        yield* visible(page.getByRole("heading", { level: 1, name: "Packages" }))
        expect((yield* Clock.currentTimeMillis) - headerNavigationStarted).toBeLessThan(1_500)
        expect(yield* documents).toHaveLength(1)

        yield* goto(page, "/")
        yield* click(page.getByRole("link", { exact: true, name: "Browse the packages" }))
        yield* visible(page.getByRole("heading", { level: 1, name: "Packages" }))
        yield* Effect.forEach(cards, (card) => count(page.locator("main").locator(`a[href="/docs/${card.id}"]`), 1))

        const cardNavigationStarted = yield* Clock.currentTimeMillis
        yield* click(page.locator("main").locator("a[href=\"/docs/effect-search\"]"))
        yield* visible(page.getByRole("heading", { level: 1, name: "@scenesystems/effect-search" }))
        expect((yield* Clock.currentTimeMillis) - cardNavigationStarted).toBeLessThan(1_500)
        expect(yield* documents).toHaveLength(1)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("docs navigation, package selection, and focused API caching stay coherent", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        const docsData = yield* observeRequests(page, (request) => request.url.includes("/docs-data/"))
        const askPageLoads = Effect.map(docsData, Arr.filter(Str.endsWith("/Study/api-ask.json")))

        yield* goto(page, "/docs/effect-search")
        const apiToggle = page.getByRole("button", { name: "Toggle api navigation" })
        const studyLink = page.getByRole("link", { exact: true, name: "Study" })
        yield* hidden(studyLink)
        yield* click(apiToggle)
        yield* visible(studyLink)
        yield* click(apiToggle)
        yield* hidden(studyLink)
        yield* click(apiToggle)
        yield* visible(studyLink)

        yield* click(page.getByRole("link", { exact: true, name: "Getting started" }))
        yield* visible(page.getByRole("heading", { level: 1, name: "Getting started" }))
        yield* attribute(page.getByRole("link", { exact: true, name: "Getting started" }), "aria-current", "page")

        yield* click(studyLink)
        yield* visible(page.getByRole("heading", { level: 1, name: "Study" }))
        yield* visible(page.getByText("Runs, observes, snapshots, and resumes optimization studies."))

        yield* click(page.locator("a[href=\"#api-ask\"]"))
        yield* urlMatches(page, /\/docs\/effect-search\/api\/Study#api-ask$/u)
        yield* visible(page.getByRole("heading", { level: 1, name: "ask" }))
        yield* visible(page.getByText("Reserves the next sampled configuration and emits TrialStarted."))
        expect(yield* askPageLoads).toHaveLength(1)

        yield* click(page.getByRole("link", { exact: true, name: "← Study" }))
        yield* click(page.locator("a[href=\"#api-ask\"]"))
        yield* visible(page.getByRole("heading", { level: 1, name: "ask" }))
        expect(yield* askPageLoads).toHaveLength(0)

        yield* click(page.getByRole("button", { name: "Choose package" }))
        yield* click(page.getByRole("menuitem").filter({ hasText: "@scenesystems/effect-math" }))
        yield* urlMatches(page, /\/docs\/effect-math$/u)
        yield* visible(page.getByRole("heading", { level: 1, name: "@scenesystems/effect-math" }))
        yield* click(page.getByRole("link", { name: "Documentation home" }))
        yield* visible(page.getByRole("heading", { level: 1, name: "Packages" }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("guide navigation preserves a useful loading shell", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        const runtime = yield* Effect.runtime<never>()
        const gate = yield* Deferred.make<void>()

        // Hold the real guide response until the skeleton has been observed.
        yield* act(() =>
          page.route(
            "**/packages/effect-search/guides/getting-started.json",
            (route) =>
              Runtime.runPromise(runtime)(Deferred.await(gate).pipe(Effect.andThen(act(() => route.continue()))))
          )
        )

        yield* goto(page, "/docs/effect-search")
        yield* click(page.getByRole("link", { exact: true, name: "Getting started" }))
        yield* visible(page.locator("[data-docs-skeleton=\"guide\"]"))
        yield* Deferred.succeed(gate, undefined)
        yield* visible(page.getByRole("heading", { level: 1, name: "Getting started" }))
        yield* count(page.locator("[data-docs-skeleton=\"guide\"]"), 0)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("package guides keep runnable examples and public API links in the documentation", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()

        yield* goto(page, "/docs/effect-search/examples")
        yield* visible(page.getByRole("heading", { level: 1, name: "Examples" }))
        yield* visible(page.getByRole("heading", { name: "Quick start" }))
        const guideCode = page.getByRole("region", { name: "ts code example" })
        yield* containsText(guideCode.locator("pre code > span:first-child > span:last-child"), /^import/u)
        yield* containsText(guideCode, "SearchSpace")
        yield* someCount(guideCode.locator(codeTokens))
        yield* visible(guideCode.getByRole("button", { name: "Copy ts" }))

        yield* goto(page, "/docs/effect-math/domains")
        const contractsLink = page.getByRole("link", { exact: true, name: "@scenesystems/effect-math/contracts" })
        yield* attribute(contractsLink, "href", "/docs/effect-math/api/contracts")
        yield* click(contractsLink)
        yield* visible(page.getByRole("heading", { level: 1, name: "contracts" }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("search is typo-tolerant, fast, cached, and routable", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        const indexLoads = yield* observeRequests(page, (request) => request.url.endsWith("/search-index.json"))

        yield* goto(page, "/docs/effect-search")
        yield* click(page.getByRole("button", { name: "Search documentation" }))
        const input = page.getByRole("combobox", { name: "Search" })
        yield* visible(input)
        const searchStarted = yield* Clock.currentTimeMillis
        yield* fill(input, "resreves trial")
        const askResult = page.getByRole("option", { name: /Study\.ask/u })
        yield* visible(askResult)
        expect((yield* Clock.currentTimeMillis) - searchStarted).toBeLessThan(750)
        expect(yield* indexLoads).toHaveLength(1)
        yield* click(askResult)
        yield* visible(page.getByRole("heading", { level: 1, name: "ask" }))

        yield* click(page.getByRole("button", { name: "Search documentation" }))
        yield* visible(input)
        yield* fill(input, "zzzz-no-such-symbol")
        yield* visible(page.getByText("No results", { exact: true }))
        expect(yield* indexLoads).toHaveLength(0)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("focused signatures highlight and copy their real source", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ permissions: ["clipboard-read", "clipboard-write"] })

        yield* goto(page, "/docs/effect-search/api/Study#api-ask")
        yield* visible(page.getByRole("heading", { level: 1, name: "ask" }))
        const signature = page.getByRole("region", { name: "Signature code example" })
        yield* someCount(signature.locator(codeTokens))
        yield* someCount(page.locator("dt code").first().locator("[class^=\"text-code-\"], [class*=\" text-code-\"]"))
        yield* click(signature.getByRole("button", { name: "Copy Signature" }))
        yield* visible(signature.getByRole("button", { name: "Copied Signature" }))
        expect(yield* act(() => page.evaluate(() => navigator.clipboard.readText()))).toContain("ask")
        expect(yield* failures).toEqual([])
      }))

    it.scoped("mobile navigation changes packages and guides without page overflow", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })

        yield* goto(page, "/docs/effect-search")
        yield* visible(page.getByRole("heading", { level: 1, name: "@scenesystems/effect-search" }))
        expect(yield* fitsViewport(page)).toBe(true)

        yield* click(page.getByRole("button", { name: "Open navigation" }))
        const navigation = page.getByRole("dialog")
        yield* visible(navigation)
        yield* visible(navigation.getByRole("heading", { name: "Menu" }))
        yield* click(navigation.getByRole("button", { name: "Choose package" }))
        yield* click(page.getByRole("menuitem").filter({ hasText: "@scenesystems/effect-math" }))
        yield* urlMatches(page, /\/docs\/effect-math$/u)
        yield* hidden(navigation)

        yield* click(page.getByRole("button", { name: "Open navigation" }))
        yield* click(navigation.getByRole("link", { exact: true, name: "Getting started" }))
        yield* visible(page.getByRole("heading", { level: 1, name: "Getting started" }))
        yield* hidden(navigation)
        expect(yield* fitsViewport(page)).toBe(true)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("focused signatures remain reachable at short height and increased text", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 500 } })

        yield* goto(page, "/docs/effect-search/api/Study#api-ask")
        yield* visible(page.getByRole("heading", { level: 1, name: "ask" }))
        expect(yield* fitsViewport(page)).toBe(true)

        yield* setViewport(page, { width: 1440, height: 900 })
        yield* act(() =>
          page.evaluate(() => {
            document.documentElement.style.fontSize = "200%"
          })
        )
        const signature = page.getByRole("region", { name: "Signature code example" })
        const overflow = yield* act(() =>
          signature.evaluate((region) => {
            const scroller = [...region.querySelectorAll<HTMLElement>("*")].find((element) =>
              element.scrollWidth > element.clientWidth && getComputedStyle(element).overflowX !== "visible"
            )
            if (!scroller) return null
            scroller.scrollLeft = scroller.scrollWidth
            return {
              atEnd: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1,
              contained: region.getBoundingClientRect().right <= document.documentElement.clientWidth
            }
          })
        )

        expect(overflow).toEqual({ atEnd: true, contained: true })
        expect(yield* fitsViewport(page)).toBe(true)
        expect(yield* failures).toEqual([])
      }))
  }
)
