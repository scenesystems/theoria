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
  holdResponse,
  hover,
  openPage,
  phone,
  press,
  until,
  visible
} from "./browser.js"
import {
  activeElementWithin,
  answerPopupsShowing,
  isActiveElement,
  scrollElementTo,
  visibleElementIds
} from "./platform/in-page.js"
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

        // Every mark on the page, pressed, is the one the answer stands over, and the answer names the
        // package whose call made it. Pressing the next mark moves the answer there; nothing is dismissed first.
        // Marks are held by id: scrolling to one changes the act being read, and the proposing act
        // brings ghosts to the paper's margin, so a mark's place in document order is not its own.
        const marks = demo.locator("[data-provenance]")
        const pressable = yield* act(() => marks.evaluateAll(visibleElementIds))
        expect(pressable.length).toBeGreaterThan(0)
        yield* Effect.forEach(pressable, (id) =>
          Effect.gen(function*() {
            const mark = demo.locator(`[id="${id}"]`)
            yield* act(() => mark.scrollIntoViewIfNeeded())
            yield* click(mark)
            yield* attribute(mark, "data-popup-open", "")
            yield* visible(overlay)
            yield* attribute(overlay.locator("[data-current] a[href^='/docs/']").first(), "href", /^\/docs\/[a-z-]+$/u)
          }))
        yield* count(demo.locator("[data-provenance][data-popup-open]"), 1)
        yield* press(page, "Escape")
        yield* hidden(overlay)

        // A code line pressed is lit, and so is every disc it made.
        const composeLine = page.locator("[data-place-code-step='compose'] [data-code-annotation]").first()
        yield* act(() => composeLine.scrollIntoViewIfNeeded())
        yield* click(composeLine)
        yield* visible(overlay)
        yield* count(page.locator("[data-code-line-focused]"), 1)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 4)

        // The line itself is a mark, by its number in the gutter: the same answer as its value's, the same lighting.
        const composeGutter = page.locator("[data-place-code-step='compose'] [data-place-code-line]").first()
        yield* attribute(composeGutter, "data-place-code-site", "compose")
        yield* attribute(composeGutter, "aria-label", /^Line \d+$/u)
        yield* press(page, "Escape")
        yield* hidden(overlay)
        yield* click(composeGutter)
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
        yield* press(page, "Escape")
        yield* hidden(overlay)
        yield* click(digestLine)
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
        // The digest's answer stays until dismissed — over the step tabs, here — so it is let go first.
        yield* press(page, "Escape")
        yield* hidden(overlay)
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
                    yield* press(page, "Escape")
                    yield* hidden(overlay)
                    yield* click(mark)
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
        // The lines are not native buttons; Space presses one as Enter does, and a second press on the
        // open mark closes its answer — the same press, the other way. A line presses when Space goes
        // down, so the key comes up with the answer open: the answer itself holds focus then, and the
        // key's release presses nothing inside it — one answer, and no preview opened by the same Space.
        yield* press(page, "Space")
        yield* visible(overlay)
        yield* containsText(overlay.getByRole("heading", { level: 3 }), /^Line 2 of \d+$/u)
        yield* eventually(() => page.evaluate(activeElementWithin, "[data-place-provenance]"), true)
        yield* Effect.sleep(Duration.millis(200))
        yield* count(page.getByRole("dialog"), 1)
        // Back through the answer to its mark, which stands just before the popup in the tab sequence.
        yield* press(page, "Shift+Tab").pipe(
          Effect.andThen(act(() => line(1).evaluate(isActiveElement))),
          Effect.repeat({ until: (onMark) => onMark, times: 6 })
        )
        expect(yield* act(() => line(1).evaluate(isActiveElement))).toBe(true)
        yield* visible(overlay)
        yield* press(page, "Space")
        yield* hidden(overlay)
        yield* count(demo.locator("[data-place-line][data-place-focused]"), 0)
        expect(yield* act(() => line(1).evaluate(isActiveElement))).toBe(true)

        // A merged proposal's name, pressed, lights its disc and the line of the drawing its sentence stands on.
        const merged = demo.locator("[data-place-proposal][data-place-recorded='true']").first()
        const name = merged.locator("[data-place-feature]")
        const featureName = yield* act(() => name.innerText())
        yield* act(() => name.scrollIntoViewIfNeeded())
        yield* click(name)
        yield* visible(overlay)
        yield* attribute(name, "data-place-focused", "")
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 1)
        yield* count(demo.locator("[data-place-line][data-place-focused]"), 1)
        const litLine = demo.locator("[data-place-line][data-place-focused]")
        const anchored = yield* Option.fromNullable(yield* act(() => litLine.getAttribute("data-place-line")))
        // The declined proposal's sentence is not in the prose: its name lights no line.
        const declined = demo.locator("[data-place-proposal][data-place-recorded='false']").first()
        yield* click(declined.locator("[data-place-feature]"))
        yield* eventually(() => demo.locator("[data-place-line][data-place-focused]").count(), 0)

        // And the other way: that line, pressed, lights the proposal's name and its disc, and says what it adds.
        yield* act(() => line(Number(anchored)).scrollIntoViewIfNeeded())
        yield* click(line(Number(anchored)))
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
        yield* click(line(Number(anchored) - 1))
        yield* eventually(() => line(Number(anchored) - 1).getAttribute("data-place-focused"), "")
        yield* count(demo.locator("[data-place-feature][data-place-focused]"), 0)
        yield* count(demo.locator("[data-place-marker][data-place-focused]"), 0)
        expect(yield* failures).toEqual([])
      }))

    /**
     * A mark answers when pressed, and only then. The pointer resting on a
     * mark reveals nothing, however long it rests; the pointer leaving an
     * open answer changes nothing. A press takes focus into the answer and
     * Escape hands it back to the mark; a second press on the same mark closes
     * it, and a press on another mark moves the answer there.
     */
    it.scoped("the pointer reveals nothing; a press opens, moves and closes the answer", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const disc = demo.locator("[data-place-marker]").first()
        const line = demo.locator("[data-place-line='2']")
        const body = page.locator("body")

        // Resting on a disc, then on a line of prose, past any delay the page ever kept: nothing opens.
        yield* act(() => disc.scrollIntoViewIfNeeded())
        yield* hover(disc)
        yield* Effect.sleep(Duration.millis(700))
        yield* hidden(overlay)
        yield* hover(line)
        yield* Effect.sleep(Duration.millis(700))
        yield* hidden(overlay)
        yield* count(demo.locator("[data-provenance][data-popup-open]"), 0)
        yield* count(demo.locator("[data-place-focused]"), 0)
        expect(yield* act(() => body.evaluate(isActiveElement))).toBe(true)

        // A press opens the disc's answer with focus inside it, and the pointer leaving changes nothing.
        yield* click(disc)
        yield* visible(overlay)
        yield* attribute(disc, "data-popup-open", "")
        expect(yield* act(() => page.evaluate(activeElementWithin, "[data-place-provenance]"))).toBe(true)
        yield* act(() => page.mouse.move(0, 0))
        yield* Effect.sleep(Duration.millis(600))
        yield* visible(overlay)

        // Another mark pressed moves the answer to it; the first is no longer the one answered, and focus
        // stays with the mark pressed — the answer moving is not the answer closing, so nothing is handed back.
        yield* click(line)
        yield* attribute(line, "data-popup-open", "")
        yield* count(demo.locator("[data-provenance][data-popup-open]"), 1)
        yield* containsText(overlay.locator("[data-current]").getByRole("heading", { level: 3 }), /^Line 3 of \d+$/u)
        yield* Effect.sleep(Duration.millis(200))
        expect(yield* act(() => line.evaluate(isActiveElement))).toBe(true)
        expect(yield* act(() => disc.evaluate(isActiveElement))).toBe(false)

        // The same mark pressed again closes it, and focus is back on the mark.
        yield* click(line)
        yield* hidden(overlay)
        yield* eventually(() => line.evaluate(isActiveElement), true)

        // Escape does the same from inside the answer.
        yield* click(disc)
        yield* visible(overlay)
        yield* press(page, "Escape")
        yield* hidden(overlay)
        yield* eventually(() => disc.evaluate(isActiveElement), true)

        // A press on nothing in particular — the demo's own heading — closes the answer, and focus is back on the mark.
        yield* click(disc)
        yield* visible(overlay)
        yield* click(demo.getByRole("heading", { level: 2 }).first())
        yield* hidden(overlay)
        yield* eventually(() => disc.evaluate(isActiveElement), true)

        // A press on a control closes the answer too, and focus is where the visitor put it: on the control.
        const brief = page.locator("[data-place-step='compose']").getByRole("textbox")
        yield* click(disc)
        yield* visible(overlay)
        yield* click(brief)
        yield* hidden(overlay)
        yield* eventually(() => brief.evaluate(isActiveElement), true)
        expect(yield* failures).toEqual([])
      }))

    /**
     * A declined proposal's ghost stands at the paper's margin only while the
     * proposing act is read. Its feature is still in the build, so the page
     * could go on answering for it — but the mark that opened the answer has
     * left, and an answer with no mark to stand over closes, letting focus
     * stay where the reader is rather than handing it to whatever was focused
     * before.
     */
    it.scoped("a mark leaving the page takes its answer with it", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const stage = page.locator("[data-place-stage-act]")
        const ghosts = demo.locator("[data-place-ghost]")

        yield* act(() => page.locator("[data-place-act='propose']").evaluate(scrollElementTo, 0.45))
        yield* attribute(stage, "data-place-stage-act", "propose")
        yield* until(act(() => ghosts.count()), (found) => found >= 1, "a ghost disc")
        const ghost = ghosts.first()
        yield* click(ghost)
        yield* visible(overlay)
        yield* attribute(ghost, "data-popup-open", "")
        expect(yield* act(() => page.evaluate(activeElementWithin, "[data-place-provenance]"))).toBe(true)

        // Reading on to the record takes the ghosts off the paper, and the answer with them.
        yield* act(() => page.locator("[data-place-act='record']").evaluate(scrollElementTo, 0.45))
        yield* attribute(stage, "data-place-stage-act", "record")
        yield* count(ghosts, 0)
        yield* hidden(overlay)
        yield* count(demo.locator("[data-provenance][data-popup-open]"), 0)
        yield* count(demo.locator("[data-place-focused]"), 0)
        // Focus was not handed anywhere: nothing on the page holds it.
        yield* Effect.sleep(Duration.millis(200))
        expect(yield* act(() => page.locator("body").evaluate(isActiveElement))).toBe(true)
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
        const scenarios = demo.getByRole("radiogroup", { name: "Scenario" })
        const radio = scenarios.getByRole("radio", { name: placeScenarioMeta["lost-market"].label })
        // The next story's build is held at the browser's edge, so the old drawing stays on the paper
        // for as long as the test needs: the press that chose the story is over before the answer opens,
        // and cannot be what closes it.
        const build = yield* holdResponse(page, "POST", "/api/imagined-place/build")
        yield* click(radio)
        yield* attribute(radio, "aria-checked", "true")
        yield* click(disc)
        yield* visible(overlay)
        const title = yield* Option.fromNullable(yield* act(() => heading.textContent()))
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
        // A few frames of the pending build are sampled with the answer open before it is let go.
        yield* Effect.sleep(Duration.millis(200))
        yield* build.release
        const popupUntilGone = yield* Fiber.join(sampling)
        const whileOnPage = Arr.filter(popupUntilGone, ({ popups }) => popups > 0)
        expect(whileOnPage.length).toBeGreaterThan(8)
        expect(Arr.every(whileOnPage, ({ titles }) => titles.length === 1 && titles[0] === title)).toBe(true)
        yield* hidden(overlay)
        // The answer went with its drawing, not with a press: no mark of the new drawing was handed focus.
        yield* count(demo.locator("[data-provenance][data-popup-open]"), 0)
        yield* count(demo.locator("[data-place-focused]"), 0)
        expect(yield* act(() => page.locator("body").evaluate(isActiveElement))).toBe(true)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a preview opened from an answer stacks on it, and each dismisses in turn", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const overlay = page.locator("[data-place-provenance]")
        const line = demo.locator("[data-place-line='2']")

        // The pressed line's answer stays wherever the pointer goes.
        yield* act(() => line.scrollIntoViewIfNeeded())
        yield* click(line)
        yield* visible(overlay)
        yield* act(() => page.mouse.move(0, 0))
        yield* Effect.sleep(Duration.millis(600))
        yield* visible(overlay)

        // A docs link pressed inside the answer opens its preview over the answer; both stay.
        yield* click(overlay.locator("a[href^='/docs/']").first())
        const preview = page.locator("[data-docs-link-preview]")
        yield* visible(preview)
        yield* act(() => page.mouse.move(0, 0))
        yield* Effect.sleep(Duration.millis(600))
        yield* visible(preview)
        yield* visible(overlay)

        // Escape dismisses the innermost first: the preview, then the answer, focus back on the line.
        yield* press(page, "Escape")
        yield* hidden(preview)
        yield* visible(overlay)
        yield* press(page, "Escape")
        yield* hidden(overlay)
        yield* eventually(() => line.evaluate(isActiveElement), true)
        expect(yield* failures).toEqual([])
      }))
  }
)
