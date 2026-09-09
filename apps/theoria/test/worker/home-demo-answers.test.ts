// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Chunk, Duration, Effect, Fiber, Layer, Option, Schedule, Stream } from "effect"
import * as Arr from "effect/Array"

import { placeScenarioMeta } from "../../app/contracts/imagined-place.js"
import { placeStepDefinitions } from "../../app/web/view/home/placeSteps.js"
import {
  act,
  attribute,
  BrowserLive,
  click,
  containsText,
  count,
  eventually,
  focus,
  goto,
  hidden,
  hover,
  openPage,
  phone,
  press,
  visible
} from "./browser.js"
import { activeElementRole, answerPopupsShowing, isActiveElement, scrollElementTo } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

import { drawn, fromAnswerToItsCode } from "./demo.js"

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria home page demo in Chromium: marks and their answers",
  (it) => {
    it.scoped("every mark answers, and the answer lights what made it", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")

        // Every mark on the page, pointed at, names the package whose call made it.
        const marks = demo.locator("[data-provenance]")
        const total = yield* act(() => marks.count())
        expect(total).toBeGreaterThan(0)
        const pointable = yield* Effect.filter(Arr.range(0, total - 1), (index) =>
          act(() => marks.nth(index).isVisible()))
        expect(pointable.length).toBeGreaterThan(0)
        yield* Effect.forEach(pointable, (index) =>
          Effect.gen(function*() {
            const mark = marks.nth(index)
            yield* act(() =>
              mark.scrollIntoViewIfNeeded()
            )
            yield* hover(mark)
            yield* visible(overlay)
            yield* attribute(overlay.locator("a[href^='/docs/']").first(), "href", /^\/docs\/[a-z-]+$/u)
          }))

        // A code line pointed at is lit, and so is every disc it made.
        const composeLine = page.locator("[data-place-code-step='compose'] [data-code-annotation]").first()
        yield* act(() => composeLine.scrollIntoViewIfNeeded())
        yield* hover(composeLine)
        yield* visible(overlay)
        yield* count(page.locator("[data-code-line-focused]"), 1)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 4)

        // The line itself is a mark, by its number in the gutter: the same answer as its value's, the same lighting.
        const composeGutter = page.locator("[data-place-code-step='compose'] [data-place-code-line]").first()
        yield* attribute(composeGutter, "data-place-code-site", "compose")
        yield* attribute(composeGutter, "aria-label", /^Line \d+$/u)
        yield* act(() => page.mouse.move(0, 0))
        yield* hidden(overlay)
        yield* hover(composeGutter)
        yield* visible(overlay)
        yield* containsText(overlay.locator("[data-current]").getByRole("heading", { level: 3 }), /\S/u)
        yield* count(page.locator("[data-code-line-focused]"), 1)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 4)
        // Only the lines that made something are marks; the rest of the gutter is numbers.
        const gutterMarks = yield* act(() =>
          page.locator("[data-place-code-step='compose'] [data-place-code-line]").count()
        )
        expect(gutterMarks).toBe(2)

        // The line that digested the neighbor's proposal lights the one disc that proposal put on the paper.
        const built = page.locator("[data-place-how-its-built]")
        const propose = yield* Arr.findFirst(placeStepDefinitions, (step) => step.id === "propose")
        yield* click(built.getByRole("tab", { name: propose.name }))
        const digestLine = built.locator("[data-provenance*='proposal-digest'] [data-code-annotation]")
        yield* act(() => digestLine.scrollIntoViewIfNeeded())
        yield* act(() => page.mouse.move(0, 0))
        yield* hidden(overlay)
        yield* hover(digestLine)
        yield* visible(overlay)
        const neighborName = yield* Option.fromNullable(
          yield* act(() =>
            demo.locator("[data-place-proposal='neighbor'] [data-place-feature]").getAttribute("data-place-feature")
          )
        )
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 1)
        yield* attribute(demo.locator("[data-place-marker][data-place-focused]"), "data-place-marker", neighborName)

        // Each line of the arrangement answers with what it made, credited to its own package:
        // the first narrowed line from the layout, lit on the stage; the search's kept trial from
        // the call that scored it and from the call that recorded it, which light no line of prose.
        // Each site is two marks, the value beside the line and the line's number, and both answer alike.
        const arrange = yield* Arr.findFirst(placeStepDefinitions, (step) => step.id === "arrange")
        yield* click(built.getByRole("tab", { name: arrange.name }))
        // Between two answers the overlay holds both for a moment; the title asked about is the current one's.
        const title = overlay.locator("[data-current]").getByRole("heading", { level: 3 })
        const credited = overlay.locator("[data-current] a[href^='/docs/']").first()
        const litLines = demo.locator("[data-place-line][data-place-focused]")
        yield* Effect.forEach(
          [
            { site: "layout", title: /^Line \d+ of \d+$/u, href: "/docs/effect-text", lit: 1 },
            { site: "separation", title: /^Trial \d+ · kept$/u, href: "/docs/effect-math", lit: 0 },
            { site: "search", title: /^Trial \d+ · kept$/u, href: "/docs/effect-search", lit: 0 }
          ],
          (expected) =>
            Effect.gen(function*() {
              const marks = built.locator(`[data-provenance*='${expected.site}']`)
              yield* count(marks, 2)
              yield* Effect.forEach(
                [marks.locator("[data-code-annotation]"), marks.and(page.locator("[data-place-code-line]"))],
                (mark) =>
                  Effect.gen(function*() {
                    yield* act(() => mark.scrollIntoViewIfNeeded())
                    yield* act(() => page.mouse.move(0, 0))
                    yield* hidden(overlay)
                    yield* hover(mark)
                    yield* visible(overlay)
                    yield* containsText(title, expected.title)
                    yield* attribute(credited, "href", expected.href)
                    yield* count(page.locator("[data-code-line-focused]"), 1)
                    yield* count(litLines, expected.lit)
                  })
              )
            })
        )
        expect(yield* failures).toEqual([])
      }))

    /**
     * The answer's credited line is a route, not a hash: following it selects
     * the step whose code holds the line, closes the answer where it is, and
     * lands focus on the line's own gutter mark in the middle of the viewport.
     * By keyboard the landing shows its ring; under reduced motion it lands at
     * once rather than gliding.
     */
    it.scoped("an answer's credited line, followed by pointer, lands on that line of code", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId } = yield* fromAnswerToItsCode("pointer", "no-preference")
        expect(landing).toMatchObject({ site: siteId, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("an answer's credited line, followed by keyboard, lands on that line with its focus ring", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId } = yield* fromAnswerToItsCode("keyboard", "no-preference")
        expect(landing).toEqual({ site: siteId, focusVisible: true, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("under reduced motion the credited line is landed on at once", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId } = yield* fromAnswerToItsCode("keyboard", "reduce")
        expect(landing).toEqual({ site: siteId, focusVisible: true, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    /**
     * On a phone the gutter is as much the line's mark as on a desk: the route
     * lands on it there too, and a line of the prose, credited to a step other
     * than the one open, lands with that step's code shown.
     */
    it.scoped("on a phone, a disc's credited line, followed by pointer, is landed on", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId } = yield* fromAnswerToItsCode("pointer", "no-preference", "disc", phone)
        expect(landing).toMatchObject({ site: siteId, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("on a phone, a prose line's credited line, followed by keyboard, opens its own step and lands", () =>
      Effect.gen(function*() {
        const { failures, landing, siteId, step } = yield* fromAnswerToItsCode(
          "keyboard",
          "no-preference",
          "line",
          phone
        )
        expect(step).toBe("arrange")
        expect(landing).toEqual({ site: siteId, focusVisible: true, inViewport: true })
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the lines answer from the keyboard, and a proposal lights the line its sentence stands on", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const lines = demo.getByRole("toolbar", { name: "Lines of the prose" })
        const line = (index: number) => lines.locator(`[data-place-line='${String(index)}']`)

        // One stop in the tab order; the arrows move between lines; Enter answers the line under focus.
        yield* attribute(lines, "aria-orientation", "vertical")
        yield* attribute(line(0), "tabindex", "0")
        yield* attribute(line(1), "tabindex", "-1")
        yield* focus(line(0))
        yield* press(page, "ArrowDown")
        expect(yield* act(() => line(1).evaluate(isActiveElement))).toBe(true)
        yield* press(page, "Enter")
        yield* visible(overlay)
        yield* containsText(overlay.getByRole("heading", { level: 3 }), /^Line 2 of \d+$/u)
        yield* attribute(line(1), "data-place-focused", "")
        yield* press(page, "Escape")
        yield* hidden(overlay)
        // A pressed answer hands focus back to the mark that opened it.
        yield* eventually(() => line(1).evaluate(isActiveElement), true)

        // A merged proposal's name, pointed at, lights its disc and the line of the drawing its sentence stands on.
        const merged = demo.locator("[data-place-proposal][data-place-recorded='true']").first()
        const name = merged.locator("[data-place-feature]")
        const featureName = yield* act(() => name.innerText())
        yield* act(() => name.scrollIntoViewIfNeeded())
        yield* hover(name)
        yield* visible(overlay)
        yield* attribute(name, "data-place-focused", "")
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 1)
        yield* count(demo.locator("[data-place-line][data-place-focused]"), 1)
        const litLine = demo.locator("[data-place-line][data-place-focused]")
        const anchored = yield* Option.fromNullable(yield* act(() => litLine.getAttribute("data-place-line")))
        // The declined proposal's sentence is not in the prose: its name lights no line.
        const declined = demo.locator("[data-place-proposal][data-place-recorded='false']").first()
        yield* hover(declined.locator("[data-place-feature]"))
        yield* eventually(() => demo.locator("[data-place-line][data-place-focused]").count(), 0)

        // And the other way: that line, pointed at, lights the proposal's name and its disc, and says what it adds.
        yield* act(() => line(Number(anchored)).scrollIntoViewIfNeeded())
        yield* hover(line(Number(anchored)))
        yield* eventually(() => line(Number(anchored)).getAttribute("data-place-focused"), "")
        const current = overlay.locator("[data-current]")
        yield* containsText(current.getByRole("heading", { level: 3 }), `Line ${String(Number(anchored) + 1)} of `)
        yield* containsText(current, featureName)
        yield* attribute(name, "data-place-focused", "")
        yield* count(demo.locator("[data-place-feature][data-place-focused]"), 1)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 1)
        // The line before it carries the composition's own words and lights no proposal. (The open
        // answer stands over that line, as a popup above its anchor does, so it is let go first.)
        yield* press(page, "Escape")
        yield* hidden(overlay)
        yield* hover(line(Number(anchored) - 1))
        yield* eventually(() => line(Number(anchored) - 1).getAttribute("data-place-focused"), "")
        yield* count(demo.locator("[data-place-feature][data-place-focused]"), 0)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 0)
        expect(yield* failures).toEqual([])
      }))

    /**
     * The pointer's intent is the page's own: a mark's answer opens after its
     * delay from entry no matter what else leaves the page meanwhile, never
     * moves focus, and stays while the pointer is on the mark, its answer, or
     * a preview opened from it. These are the rules a shared hover timer in
     * the popover library broke, and the page no longer relies on one.
     */
    it.scoped("a mark leaving while the pointer rests on another does not cancel its answer", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const built = page.locator("[data-place-how-its-built]")
        const compose = yield* Arr.findFirst(placeStepDefinitions, (step) => step.id === "compose")
        const composeTab = built.getByRole("tab", { name: compose.name })
        const composeMarks = built.locator("[data-place-code-step='compose'] [data-provenance]")

        // The code panel's tabs at the foot of the viewport, the prose above them on the stage.
        yield* act(() => composeTab.evaluate(scrollElementTo, 0.9))
        yield* focus(composeTab)
        yield* count(composeMarks, 4)
        const line = demo.locator("[data-place-line='5']")
        expect(yield* act(() => line.isVisible())).toBe(true)

        // The pointer comes to rest on a line; before its delay is up, the keyboard changes the tab
        // (the arrow moves, Enter activates), and every mark of the compose panel leaves the page.
        // The pointer has not moved.
        yield* hover(line)
        yield* press(page, "ArrowRight")
        yield* press(page, "Enter")
        yield* count(composeMarks, 0)
        yield* visible(overlay)
        yield* containsText(overlay.locator("[data-current]").getByRole("heading", { level: 3 }), /^Line 6 of \d+$/u)
        // Focus stayed with the keyboard, on the tab list.
        expect(yield* act(() => page.evaluate(activeElementRole))).toBe("tab")
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a hover answer never takes focus; a press pins it until it is dismissed", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const disc = demo.locator("[data-place-marker]").first()
        const body = page.locator("body")

        yield* act(() => disc.scrollIntoViewIfNeeded())
        yield* hover(disc)
        yield* visible(overlay)
        expect(yield* act(() => body.evaluate(isActiveElement))).toBe(true)

        // Leaving the mark and its answer closes a hover answer after the grace.
        yield* act(() => page.mouse.move(0, 0))
        yield* hidden(overlay)

        // A press on the mark of a hover answer pins it: the pointer may leave and it stays.
        yield* hover(disc)
        yield* visible(overlay)
        yield* click(disc)
        yield* act(() => page.mouse.move(0, 0))
        yield* Effect.sleep(Duration.millis(600))
        yield* visible(overlay)
        yield* press(page, "Escape")
        yield* hidden(overlay)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("an answer opened on the drawing survives the next story's build and closes with its drawing", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const heading = overlay.locator("[data-current]").getByRole("heading", { level: 3 })
        const disc = demo.locator("[data-place-marker]").first()
        yield* click(disc)
        yield* visible(overlay)
        const title = yield* Option.fromNullable(yield* act(() => heading.textContent()))
        const scenarios = demo.getByRole("radiogroup", { name: "Scenario" })
        const radio = scenarios.getByRole("radio", { name: placeScenarioMeta["lost-market"].label })
        // The answer's title, sampled a frame apart for as long as the popup is on the page:
        // while the next story is built the old drawing stays and so does its answer; the
        // moment the new drawing replaces it the answer goes — fading with the words it had,
        // never emptied, and never having named another build's feature.
        const sampling = yield* Stream.repeatEffectWithSchedule(
          act(() => page.evaluate(answerPopupsShowing)),
          Schedule.spaced("16 millis").pipe(Schedule.upTo(Duration.seconds(12)))
        ).pipe(
          Stream.takeUntil(({ popups }) => popups === 0),
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray),
          Effect.fork
        )
        yield* click(radio)
        const popupUntilGone = yield* Fiber.join(sampling)
        const whileOnPage = Arr.filter(popupUntilGone, ({ popups }) => popups > 0)
        expect(whileOnPage.length).toBeGreaterThan(0)
        expect(Arr.every(whileOnPage, ({ titles }) => titles.length === 1 && titles[0] === title)).toBe(true)
        yield* hidden(overlay)
        expect(yield* act(() => radio.evaluate(isActiveElement))).toBe(true)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the mark, its answer and a preview opened from it are one place for the pointer", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const line = demo.locator("[data-place-line='2']")

        // From the mark into its answer: still here, well past the grace.
        yield* act(() => line.scrollIntoViewIfNeeded())
        yield* hover(line)
        yield* visible(overlay)
        yield* hover(overlay)
        yield* Effect.sleep(Duration.millis(600))
        yield* visible(overlay)

        // From the answer into a preview opened from inside it: still here.
        yield* click(overlay.locator("a[href^='/docs/']").first())
        const preview = page.locator("[data-docs-link-preview]")
        yield* visible(preview)
        yield* hover(preview)
        yield* Effect.sleep(Duration.millis(600))
        yield* visible(overlay)

        // Leaving all of it closes all of it: the answer after its grace, and the preview with it.
        yield* act(() => page.mouse.move(0, 0))
        yield* hidden(preview)
        yield* hidden(overlay)
        expect(yield* failures).toEqual([])
      }))
  }
)
