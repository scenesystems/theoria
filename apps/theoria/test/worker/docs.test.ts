// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Clock, Deferred, Duration, Effect, Layer, Runtime } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { cards } from "../../app/contracts/card.js"
import { elevationIndex } from "../../app/contracts/layout.js"
import { motionDuration } from "../../app/contracts/motion.js"
import { ColorMode } from "../../app/contracts/palette.js"
import { introDelaySeconds } from "../../app/web/view/primitives/wordmarkMorph.js"
import {
  act,
  attached,
  attribute,
  BrowserLive,
  click,
  containsText,
  count,
  fill,
  fitsViewport,
  goto,
  hidden,
  highlighted,
  hover,
  observeRequests,
  openPage,
  press,
  setColorScheme,
  setViewport,
  until,
  urlMatches,
  visible,
  wheel
} from "./browser.js"
import {
  backgroundColour,
  boxOf,
  clipboardText,
  greekFaceOpacities,
  horizontalScrollers,
  presence,
  resolvedChrome,
  scrollAffordance,
  setRootFontSize,
  systemColour,
  textFitsBox,
  typographyOf,
  underlineDrawn
} from "./platform/in-page.js"
import { SiteLive } from "./site.js"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria docs in Chromium",
  (it) => {
    it.scoped("the package picker keeps its field height when API navigation overflows the sidebar", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ reducedMotion: "reduce" })
        yield* Effect.forEach([1200, 720, 500], (height) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width: 1440, height })
            yield* goto(page, "/docs/digest")
            const sidebar = page.getByRole("complementary", { name: "Documentation navigation" })
            const picker = sidebar.getByRole("button", { name: "Choose package" })
            yield* visible(picker)
            expect((yield* act(() => picker.evaluate(boxOf))).height, `overview at ${String(height)}px`).toBe(44)

            yield* click(sidebar.getByRole("link", { name: "API reference", exact: true }))
            yield* urlMatches(page, /\/docs\/digest\/api$/u)
            yield* visible(sidebar.getByRole("link", { name: "Blake3", exact: true }))
            const box = yield* act(() => picker.evaluate(boxOf))
            expect(box.height, `expanded API navigation at ${String(height)}px`).toBe(44)
            expect(yield* act(() => picker.evaluate(textFitsBox))).toBe(true)

            yield* click(picker)
            yield* visible(page.getByRole("menu"))
            yield* click(page.getByRole("menuitem").filter({ hasText: "@scenesystems/effect-math" }))
            yield* urlMatches(page, /\/docs\/effect-math$/u)
            expect(yield* fitsViewport(page)).toBe(true)
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("docs chrome reaches both edges and the package index shares the header's left alignment", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ reducedMotion: "reduce" })
        yield* Effect.forEach([1440, 1920, 2560], (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 900 })
            yield* goto(page, "/docs")
            yield* visible(page.getByRole("heading", { level: 1, name: "Packages" }))
            const canvas = yield* act(() => page.locator("body").evaluate(boxOf))
            const header = yield* act(() => page.locator("header > div").evaluate(boxOf))
            expect(header.left).toBe(0)
            expect(header.right).toBe(canvas.right)
            const logo = yield* act(() => page.locator("header a[href='/'] svg").evaluate(boxOf))
            const title = yield* act(() => page.getByRole("heading", { level: 1 }).evaluate(boxOf))
            expect(title.left).toBe(logo.left)

            yield* goto(page, "/docs/digest")
            const sidebar = page.getByRole("complementary", { name: "Documentation navigation" })
            yield* visible(sidebar)
            expect((yield* act(() => sidebar.evaluate(boxOf))).left).toBe(0)
            const picker = yield* act(() => sidebar.getByRole("button", { name: "Choose package" }).evaluate(boxOf))
            expect(picker.left).toBe(logo.left)
            const links = sidebar.getByRole("link")
            expect(yield* act(() => links.evaluateAll((elements) => elements.length))).toBeGreaterThan(5)
            yield* Effect.forEach(Arr.range(0, (yield* act(() => links.count())) - 1), (index) =>
              Effect.gen(function*() {
                expect(yield* act(() => links.nth(index).evaluate(textFitsBox))).toBe(true)
              }))
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("package cards answer hover and press with their background, never a title underline", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ reducedMotion: "reduce" })
        yield* Effect.forEach(ColorMode.literals, (scheme) =>
          Effect.gen(function*() {
            yield* setColorScheme(page, scheme)
            yield* goto(page, "/docs")
            const card = page.locator("[data-docs-package='digest']")
            yield* visible(card)
            yield* hover(card)
            const hoverColour = yield* act(() => page.evaluate(systemColour, "var(--th-instrument-glass)"))
            yield* until(
              act(() => card.evaluate(backgroundColour)),
              (color) => color === hoverColour,
              "card hover wash"
            )
            expect((yield* act(() => card.locator("h2").evaluate(underlineDrawn))).lines).not.toContain("underline")
            yield* act(() => page.mouse.down())
            const pressedColour = yield* act(() => page.evaluate(systemColour, "var(--th-instrument)"))
            expect(pressedColour).not.toBe(hoverColour)
            yield* until(
              act(() => card.evaluate(backgroundColour)),
              (color) => color === pressedColour,
              "card pressed wash"
            )
            yield* act(() => page.mouse.up())
            yield* urlMatches(page, /\/docs\/digest$/u)
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("docs use the home logo's scale, showing only its mark below the sidebar breakpoint", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ reducedMotion: "reduce" })
        yield* goto(page, "/")
        const logo = page.locator("header a[href='/'] > span")
        yield* visible(logo)
        const homeType = yield* act(() => logo.evaluate(typographyOf))
        const homeMark = yield* act(() => logo.locator("svg").evaluate(boxOf))
        yield* goto(page, "/docs/effect-inference/getting-started")
        yield* Effect.forEach([320, 1023, 1024, 1920], (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 900 })
            yield* visible(logo)
            const docsType = yield* act(() => logo.evaluate(typographyOf))
            expect(docsType.size).toBe(homeType.size)
            expect(docsType.weight).toBe(homeType.weight)
            expect((yield* act(() => logo.locator("svg").evaluate(boxOf))).height).toBe(homeMark.height)
            const wordmark = logo.getByText("Theoria", { exact: true })
            yield* width < 1024 ? hidden(wordmark) : visible(wordmark)
            expect((yield* act(() => page.locator("header").evaluate(boxOf))).height).toBe(73)
            expect(yield* fitsViewport(page)).toBe(true)
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("guide, module and export pages share title and prose metrics in both modes and across the narrow breakpoint", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ reducedMotion: "reduce" })
        const pages = [
          { path: "/docs/effect-search/getting-started", title: "Getting started" },
          { path: "/docs/effect-search/api/Optimization", title: "Optimization" },
          { path: "/docs/effect-search/api/Optimization#api-ask", title: "ask" }
        ]
        yield* Effect.forEach(ColorMode.literals, (scheme) =>
          Effect.gen(function*() {
            yield* setColorScheme(page, scheme)
            yield* Effect.forEach([
              { width: 639, size: "32px", leading: "38px", tracking: "-0.64px" },
              { width: 640, size: "38px", leading: "44px", tracking: "-0.76px" }
            ], (viewport) =>
              Effect.gen(function*() {
                yield* setViewport(page, { width: viewport.width, height: 900 })
                yield* Effect.forEach(pages, (route) =>
                  Effect.gen(function*() {
                    yield* goto(page, route.path)
                    const title = page.getByRole("heading", { level: 1, name: route.title, exact: true })
                    yield* visible(title)
                    const metrics = yield* act(() => title.evaluate(typographyOf))
                    expect(metrics.family).toContain("Figtree Variable")
                    expect(metrics).toMatchObject({
                      size: viewport.size,
                      leading: viewport.leading,
                      tracking: viewport.tracking,
                      weight: "600",
                      transform: "none",
                      color: yield* act(() => page.evaluate(systemColour, "var(--th-ink-strong)"))
                    })
                    const prose = page.locator("main p").first()
                    yield* visible(prose)
                    expect(yield* act(() => prose.evaluate(typographyOf))).toMatchObject({
                      size: "16px",
                      leading: "26px",
                      weight: "400",
                      tracking: "normal",
                      color: yield* act(() => page.evaluate(systemColour, "var(--th-ink)"))
                    })
                    expect(yield* act(() => page.locator("main h2").first().evaluate(typographyOf))).toMatchObject({
                      size: viewport.width === 639 ? "21px" : "24px",
                      leading: viewport.width === 639 ? "28px" : "32px",
                      weight: "600",
                      transform: "none",
                      color: yield* act(() => page.evaluate(systemColour, "var(--th-ink-strong)"))
                    })
                    expect(yield* act(() => page.locator("header a[href=\"/\"] > span").evaluate(typographyOf)))
                      .toMatchObject({
                        size: "24px",
                        leading: "32px",
                        weight: "600",
                        tracking: "-0.6px"
                      })
                    const source = page.getByRole("link", { exact: true, name: "Source" }).first()
                    expect(yield* act(() => source.locator("span").evaluate(typographyOf))).toMatchObject({
                      size: "12px",
                      leading: "16px",
                      weight: "600",
                      color: (yield* act(() => source.evaluate(typographyOf))).color
                    })
                    expect(yield* act(() => page.locator("main code").first().evaluate(typographyOf))).toMatchObject({
                      family: expect.stringContaining("Geist Mono Variable"),
                      size: "12px",
                      leading: "18px",
                      tracking: "normal"
                    })
                    expect(yield* fitsViewport(page)).toBe(true)
                  }))
              }))
          }))
        expect(yield* failures).toEqual([])
      }))

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

    it.scoped("a route's content rises in, or under reduced motion is placed outright with the wordmark at rest", () =>
      Effect.gen(function*() {
        const full = yield* openPage()
        yield* goto(full.page, "/")
        yield* visible(full.page.getByRole("region", { name: "Imagined place demo" }))
        // The wordmark crossfades between its Latin and Greek faces, so both are in the page.
        yield* containsText(full.page.locator("header").getByRole("img", { name: "Theoria" }), "θεωρία")
        yield* click(full.page.locator("header").getByRole("link", { exact: true, name: "Docs" }))
        const entrance = full.page.locator("[data-route-entrance]")
        yield* attached(entrance)
        // Arriving: the first frames after the route mounts are the fade in.
        const arriving = yield* Effect.forEach(Arr.range(1, 12), () => act(() => entrance.evaluate(presence)))
        expect(Arr.some(arriving, (sample) => sample.opacity < 1 || sample.fading)).toBe(true)
        yield* visible(full.page.getByRole("heading", { level: 1, name: "Packages" }))

        const reduced = yield* openPage({ reducedMotion: "reduce" })
        yield* goto(reduced.page, "/")
        yield* visible(reduced.page.getByRole("region", { name: "Imagined place demo" }))
        // At rest: the Latin wordmark alone, with no Greek face to fade to.
        const wordmark = reduced.page.locator("header").getByRole("img", { name: "Theoria" })
        yield* containsText(wordmark, "Theoria")
        expect(yield* act(() => wordmark.innerText())).not.toContain("θ")
        yield* click(reduced.page.locator("header").getByRole("link", { exact: true, name: "Docs" }))
        const placed = reduced.page.locator("[data-route-entrance]")
        yield* attached(placed)
        // Placed outright: at full opacity from its first frame, fading nothing.
        const standing = yield* Effect.forEach(Arr.range(1, 12), () => act(() => placed.evaluate(presence)))
        expect(standing).toEqual(Arr.map(standing, () => ({ opacity: 1, fading: false })))
        yield* visible(reduced.page.getByRole("heading", { level: 1, name: "Packages" }))

        expect(yield* full.failures).toEqual([])
        expect(yield* reduced.failures).toEqual([])
      }))

    it.scoped("the wordmark plays one pass as the session begins, rests Latin, and plays again at once when met", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        const wordmark = page.locator("header").getByRole("img", { name: "Theoria" })
        const greek = act(() => wordmark.evaluate(greekFaceOpacities))
        const someGreek = (opacities: ReadonlyArray<number>) => Arr.some(opacities, (opacity) => opacity > 0)
        const allLatin = (opacities: ReadonlyArray<number>) =>
          opacities.length === 6 && Arr.every(opacities, (opacity) => opacity === 0)

        // The intro: after its lead hold the sweep to Greek shows…
        yield* until(greek, someGreek, "the intro's sweep to Greek", Duration.seconds(6))
        // …and the pass returns to Latin and stays there: no clock keeps the wordmark cycling.
        yield* until(greek, allLatin, "the wordmark's return to Latin", Duration.seconds(10))
        yield* Effect.sleep("1500 millis")
        expect(allLatin(yield* greek)).toBe(true)

        // Met by the pointer, it plays again, and without the lead hold: Greek shows within the first sweep.
        const met = yield* Clock.currentTimeMillis
        yield* hover(wordmark)
        yield* until(greek, someGreek, "the replay's sweep to Greek", Duration.seconds(4))
        expect((yield* Clock.currentTimeMillis) - met).toBeLessThan(introDelaySeconds * 1_000)
        yield* until(greek, allLatin, "the replay's return to Latin", Duration.seconds(10))

        // Met by the keyboard, the same.
        yield* press(page, "Tab")
        yield* until(greek, someGreek, "the focused wordmark's sweep to Greek", Duration.seconds(4))

        expect(yield* failures).toEqual([])
      }))

    it.scoped("docs navigation, package selection, and focused API caching stay coherent", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        const docsData = yield* observeRequests(page, (request) => request.url.includes("/docs-data/"))
        const askPageLoads = Effect.map(docsData, Arr.filter(Str.endsWith("/Optimization/api-ask.json")))

        yield* goto(page, "/docs/effect-search")
        yield* visible(page.locator("header").getByRole("link", { name: "Theoria on GitHub" }))
        yield* count(page.locator("header").getByRole("button", { name: "Choose package" }), 0)
        const sidebar = page.getByRole("complementary", { name: "Documentation navigation" })
        const picker = sidebar.getByRole("button", { name: "Choose package" })
        yield* visible(picker)
        const railBox = yield* act(() => sidebar.evaluate(boxOf))
        const pickerBox = yield* act(() => picker.evaluate(boxOf))
        expect(pickerBox.left).toBeGreaterThanOrEqual(railBox.left)
        expect(pickerBox.right).toBeLessThanOrEqual(railBox.right)
        const apiToggle = page.getByRole("button", { name: "Toggle api navigation" })
        const optimizationLink = page.getByRole("link", { exact: true, name: "Optimization" })
        yield* hidden(optimizationLink)
        yield* click(apiToggle)
        yield* visible(optimizationLink)
        yield* click(apiToggle)
        yield* hidden(optimizationLink)
        yield* click(apiToggle)
        yield* visible(optimizationLink)

        yield* click(page.getByRole("link", { exact: true, name: "Getting started" }))
        yield* visible(page.getByRole("heading", { level: 1, name: "Getting started" }))
        yield* attribute(page.getByRole("link", { exact: true, name: "Getting started" }), "aria-current", "page")

        yield* click(optimizationLink)
        yield* visible(page.getByRole("heading", { level: 1, name: "Optimization" }))
        yield* visible(page.getByText("Executes, streams, and manually coordinates optimizations."))

        yield* click(page.locator("a[href=\"#api-ask\"]"))
        yield* urlMatches(page, /\/docs\/effect-search\/api\/Optimization#api-ask$/u)
        yield* visible(page.getByRole("heading", { level: 1, name: "ask" }))
        yield* visible(page.getByText("Reserves a configuration."))
        expect(yield* askPageLoads).toHaveLength(1)

        yield* click(page.getByRole("link", { exact: true, name: "← Optimization" }))
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

    it.scoped("the workbench's chrome resolves to the layout and motion contracts' tokens", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        yield* goto(page, "/docs/effect-search")
        yield* visible(page.getByRole("heading", { level: 1, name: "@scenesystems/effect-search" }))

        // The workbench header is sticky at the header elevation, not a hand-typed z-index.
        const header = yield* act(() => page.locator("header").first().evaluate(resolvedChrome))
        expect(header.position).toBe("sticky")
        expect(header.zIndex).toBe(String(elevationIndex("header")))

        // A picker trigger is an instrument's corner and answers the pointer by the respond relation.
        const trigger = yield* act(() =>
          page.getByRole("button", { name: "Search documentation" }).evaluate(resolvedChrome)
        )
        expect(trigger.radius).toBe("12px")
        expect(trigger.duration).toBe(`${String(Duration.toSeconds(motionDuration("respond")))}s`)

        // A code example's frame is a sheet: the largest corner on the page.
        yield* click(page.getByRole("link", { exact: true, name: "Getting started" }))
        const frame = yield* act(() => page.locator("[aria-label$='code example']").first().evaluate(resolvedChrome))
        expect(frame.radius).toBe("24px")

        // The package menu opens at the menu elevation, above the header.
        yield* click(page.getByRole("button", { name: "Choose package" }))
        const menu = yield* act(() => page.getByRole("menu").locator("xpath=..").evaluate(resolvedChrome))
        expect(menu.zIndex).toBe(String(elevationIndex("menu")))
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
        yield* highlighted(guideCode.locator("pre code"))
        yield* visible(guideCode.getByRole("button", { name: "Copy ts" }))

        // On a phone the quick start runs longer than a code block's viewport: it is cut and scrolls, and the
        // scrollbar is painted for as long as there is more to see, since nothing on a phone hovers.
        yield* setViewport(page, { width: 390, height: 844 })
        yield* goto(page, "/docs/effect-search/examples")
        const quickStart = page.getByRole("region", { name: "ts code example" }).first()
        const block = quickStart.locator("[data-code-scroll]")
        const tall = yield* until(
          act(() => block.evaluate(scrollAffordance)),
          (affordance) => affordance.overflows,
          "the quick start taller than its viewport"
        )
        expect(tall.scrollbarPainted).toBe(true)
        expect(tall.thumbHeight).toBeGreaterThan(0)
        yield* setViewport(page, { width: 1280, height: 800 })

        yield* goto(page, "/docs/effect-math/domains")
        const policyLink = page.getByRole("link", { exact: true, name: "Policy" })
        yield* attribute(policyLink, "href", "/docs/effect-math/api/Policy")
        yield* click(policyLink)
        yield* visible(page.getByRole("heading", { level: 1, name: "Policy" }))
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
        yield* fill(input, "resreves configuration")
        const askResult = page.getByRole("option", { name: /Optimization\.ask/u })
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

        yield* goto(page, "/docs/effect-search/api/Optimization#api-ask")
        yield* visible(page.getByRole("heading", { level: 1, name: "ask" }))
        const signature = page.getByRole("region", { name: "Signature code example" })
        yield* highlighted(signature.locator("pre code"))
        yield* highlighted(page.locator("dt code").first())
        yield* click(signature.getByRole("button", { name: "Copy Signature" }))
        yield* visible(signature.getByRole("button", { name: "Copied Signature" }))
        expect(yield* act(() => page.evaluate(clipboardText))).toContain("ask")
        expect(yield* failures).toEqual([])
      }))

    it.scoped("mobile navigation changes packages and guides without page overflow", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 390, height: 844 } })

        yield* goto(page, "/docs/effect-search")
        yield* visible(page.getByRole("heading", { level: 1, name: "@scenesystems/effect-search" }))
        expect(yield* fitsViewport(page)).toBe(true)

        yield* hidden(page.locator("header").getByText("Theoria", { exact: true }))
        yield* visible(page.locator("header").getByRole("link", { name: "Theoria home" }).locator("svg"))
        yield* visible(page.locator("header").getByRole("link", { name: "Theoria on GitHub" }))
        yield* click(page.getByRole("button", { name: "Open navigation" }))
        const navigation = page.getByRole("dialog", { name: "Theoria", exact: true })
        yield* visible(navigation)
        yield* visible(navigation.getByRole("heading", { name: "Theoria" }))
        yield* visible(navigation.getByRole("heading", { name: "Theoria" }).locator("svg"))
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

        yield* goto(page, "/docs/effect-search/api/Optimization#api-ask")
        yield* visible(page.getByRole("heading", { level: 1, name: "ask" }))
        expect(yield* fitsViewport(page)).toBe(true)

        yield* setViewport(page, { width: 1440, height: 900 })
        yield* act(() => page.evaluate(setRootFontSize, "200%"))
        const signature = page.getByRole("region", { name: "Signature code example" })
        const scrollers = yield* act(() => signature.evaluate(horizontalScrollers))
        expect(scrollers.length).toBeGreaterThan(0)

        yield* hover(signature.locator("pre"))
        yield* wheel(page, 4_000, 0)
        yield* until(
          act(() => signature.evaluate(horizontalScrollers)),
          Arr.every((scroller) => scroller.atEnd && scroller.contained),
          "signature scrollers reach their end inside the viewport"
        )
        expect(yield* fitsViewport(page)).toBe(true)
        expect(yield* failures).toEqual([])
      }))
  }
)
