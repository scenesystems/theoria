// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { BrowserContext, Page } from "@playwright/test"
import { DateTime, Duration, Effect, Equal, Layer, Option } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import { evaluate, evaluateElement } from "./browser.js"

import { colorModeCookieName } from "../../app/contracts/color-mode.js"
import {
  ColorMode,
  neutralColor,
  neutralSlotRole,
  type Oklch,
  toneColor,
  type ToneSlot,
  toneSlotRole,
  toSrgb,
  type Translucency,
  translucencyAlpha
} from "../../app/contracts/palette.js"
import { Tone } from "../../app/contracts/theme.js"
import { neutralToneClasses, type ToneClasses, toneClassesFor } from "../../app/web/view/primitives/designSystem.js"
import {
  act,
  attribute,
  BrowserLive,
  click,
  eventually,
  goto,
  gotoParsed,
  hover,
  openPage,
  pointerAway,
  setColorScheme,
  visible
} from "./browser.js"
import { drawn } from "./demo.js"
import { backgroundColour, colorSchemeShown, paintedByClasses } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * The reader's colour mode. The header's control walks the three
 * preferences — following the system, light, dark — and back, so following
 * the system is always one press away and never lost. The preference is a
 * cookie, so the Worker serves the next page already in that mode: a reader
 * who chose dark never sees a light frame, with no script to do it.
 */

const followingSystem = /^Following system, currently (light|dark) — switch to light mode$/u
const pinnedLight = "Light mode — switch to dark mode"
const pinnedDark = "Dark mode — follow the system"

const themeControl = (page: Page, name: string | RegExp) => page.getByRole("button", { name })

/** The glyph the control wears, as the attribute the view sets from the preference. */
const glyphWorn = (page: Page, name: string | RegExp) =>
  act(() => themeControl(page, name).getAttribute("data-theme-glyph"))

/** A palette colour as Chromium reports a computed colour: `rgb(r, g, b)`. */
const computedCss = (color: Oklch): string => {
  const painted = toSrgb(color)
  return `rgb(${String(painted.r)}, ${String(painted.g)}, ${String(painted.b)})`
}

/** A translucent palette colour as Chromium reports it: `rgba(r, g, b, a)`. */
const computedTranslucentCss = (color: Oklch, translucency: Translucency): string => {
  const painted = toSrgb(color)
  return `rgba(${String(painted.r)}, ${String(painted.g)}, ${String(painted.b)}, ${
    String(translucencyAlpha(translucency))
  })`
}

/** The solid slots a probe wears at once, one per painted property: the accent fill and edge, the ink. */
const probeClasses = (classes: ToneClasses): string => Arr.join([classes.bg, classes.border, classes.text], " ")

/** What a probe wearing a tone's, or the neutral's, solid slots should paint. */
const expectedPaint = (colorOf: (slot: ToneSlot) => Oklch) => ({
  backgroundColor: computedCss(colorOf("bg")),
  borderColor: computedCss(colorOf("border")),
  color: computedCss(colorOf("text"))
})

/** Reads what a probe wearing `classes` paints in the page. */
const painted = (page: Page, classes: ToneClasses) => evaluate(page, paintedByClasses, probeClasses(classes))

/** The colour-mode cookie as the browser holds it for the site, if it does. */
const preferenceCookie = (context: BrowserContext) =>
  Effect.map(
    act(() => context.cookies()),
    (cookies) => Arr.findFirst(cookies, (cookie) => Equal.equals(cookie.name, colorModeCookieName))
  )

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria colour mode in Chromium",
  (it) => {
    it.scoped("every tone's solid slots, and the neutral's, paint the palette's colour in both modes", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ colorScheme: "light" })
        yield* goto(page, "/")
        yield* Effect.forEach(ColorMode.literals, (mode) =>
          Effect.gen(function*() {
            yield* setColorScheme(page, mode)
            yield* Effect.forEach(Tone.literals, (tone) =>
              Effect.map(painted(page, toneClassesFor(tone)), (paint) =>
                expect(paint, `${tone} in ${mode}`).toEqual(
                  expectedPaint((slot) =>
                    toneColor(tone, toneSlotRole(slot), mode)
                  )
                )))
            expect(yield* painted(page, neutralToneClasses), `neutral in ${mode}`).toEqual(
              expectedPaint((slot) => neutralColor(neutralSlotRole(slot), mode))
            )
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a chosen fill, a checked toggle and an answered mark each step deeper on the ladder, in both modes", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ colorScheme: "light" })
        yield* goto(page, "/")
        yield* drawn(page)
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const chosen = page.getByRole("radio", { checked: true, name: "Unfinished light" })
        const merge = page.getByRole("switch", { checked: true, name: /^Merge Finishing shelf/u })
        const line = demo.locator("[data-place-line='2']")

        yield* Effect.forEach(ColorMode.literals, (mode) =>
          Effect.gen(function*() {
            yield* setColorScheme(page, mode)

            // The scenario chosen is filled with the author's surface — a tint the eye finds on the rail —
            // and the pointer resting on it deepens the fill one step, to the wash.
            yield* pointerAway(page)
            yield* eventually(
              evaluateElement(chosen, backgroundColour),
              computedCss(toneColor("primary", "surface", mode))
            )
            yield* hover(chosen)
            yield* eventually(
              evaluateElement(chosen, backgroundColour),
              computedCss(toneColor("primary", "wash", mode))
            )

            // The neighbor's merged proposal wears the neighbor's own mark on its switch, deepened to the
            // neighbor's ink under the pointer: the same voice, one step firmer.
            yield* pointerAway(page)
            yield* eventually(
              evaluateElement(merge, backgroundColour),
              computedCss(toneColor("secondary", "accent", mode))
            )
            yield* hover(merge)
            yield* eventually(
              evaluateElement(merge, backgroundColour),
              computedCss(toneColor("secondary", "ink", mode))
            )

            // A mark is lit with a glass of the instrument while pointed at, and with the instrument itself
            // while answered, so the answer reads firmer than the pointer passing over.
            yield* act(() => line.scrollIntoViewIfNeeded())
            yield* pointerAway(page)
            yield* hover(line)
            yield* eventually(
              evaluateElement(line, backgroundColour),
              computedTranslucentCss(neutralColor("instrument", mode), "glass")
            )
            yield* click(line)
            yield* attribute(line, "data-popup-open", "")
            yield* pointerAway(page)
            yield* eventually(evaluateElement(line, backgroundColour), computedCss(neutralColor("instrument", mode)))
            yield* click(line)
            yield* pointerAway(page)
            yield* eventually(evaluateElement(line, backgroundColour), "rgba(0, 0, 0, 0)")
          }))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the control cycles system → light → dark → system, and following the system follows it live", () =>
      Effect.gen(function*() {
        const { context, failures, page } = yield* openPage({ colorScheme: "light" })
        yield* goto(page, "/")

        // A first visit follows the system, which is light: no cookie yet says otherwise. The glyph is a
        // screen, not a sun: the state is "following", whatever the system currently shows.
        yield* visible(themeControl(page, "Following system, currently light — switch to light mode"))
        expect(yield* evaluate(page, colorSchemeShown)).toBe("light")
        expect(yield* glyphWorn(page, followingSystem)).toBe("screen")

        yield* click(themeControl(page, followingSystem))
        yield* visible(themeControl(page, pinnedLight))
        expect(yield* evaluate(page, colorSchemeShown)).toBe("light")
        expect(yield* glyphWorn(page, pinnedLight)).toBe("sun")

        yield* click(themeControl(page, pinnedLight))
        yield* visible(themeControl(page, pinnedDark))
        yield* eventually(evaluate(page, colorSchemeShown), "dark")
        expect(yield* glyphWorn(page, pinnedDark)).toBe("moon")

        // Pinned dark, the system's scheme changing means nothing to the page.
        yield* act(() => page.emulateMedia({ colorScheme: "light" }))
        expect(yield* evaluate(page, colorSchemeShown)).toBe("dark")

        // The third press returns to following the system, and the page follows a flipped system at once.
        yield* click(themeControl(page, pinnedDark))
        yield* visible(themeControl(page, "Following system, currently light — switch to light mode"))
        yield* eventually(evaluate(page, colorSchemeShown), "light")
        yield* setColorScheme(page, "dark")
        yield* visible(themeControl(page, "Following system, currently dark — switch to light mode"))

        // What the reader chose is a cookie the Worker will read: site-wide, first-party, a year long.
        const cookie = yield* preferenceCookie(context)
        expect(Option.map(cookie, (found) => found.value)).toEqual(Option.some("%22system%22"))
        expect(Option.map(cookie, (found) => found.path)).toEqual(Option.some("/"))
        expect(Option.map(cookie, (found) => found.sameSite)).toEqual(Option.some("Lax"))
        const inAYear = DateTime.addDuration(yield* DateTime.now, Duration.days(360))
        expect(
          Option.map(
            cookie,
            (found) => Num.greaterThan(Num.multiply(found.expires, 1000), DateTime.toEpochMillis(inAYear))
          )
        ).toEqual(Option.some(true))
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a reader who chose dark is served a dark shell: the first frame is dark before any script runs", () =>
      Effect.gen(function*() {
        const { context, failures, page } = yield* openPage({ colorScheme: "light" })
        yield* goto(page, "/")
        yield* click(themeControl(page, followingSystem))
        yield* click(themeControl(page, pinnedLight))
        yield* visible(themeControl(page, pinnedDark))
        expect(Option.map(yield* preferenceCookie(context), (found) => found.value)).toEqual(
          Option.some("%22dark%22")
        )

        // The next document, as served: dark on the root element in the HTML itself, and cached per cookie.
        const served = yield* Option.match(
          Option.fromNullable(yield* act(() => page.goto("/docs", { waitUntil: "commit" }))),
          {
            onNone: () => Effect.dieMessage("navigating to /docs produced no response"),
            onSome: Effect.succeed
          }
        )
        expect(served.status()).toBe(200)
        expect(yield* act(() => served.text())).toContain("<html lang=\"en\" class=\"dark\">")
        expect(served.headers()["vary"]).toBe("Cookie")

        // And parsed: the root wears the class as soon as it exists, and keeps it once the app takes over.
        yield* gotoParsed(page, "/")
        expect(yield* evaluate(page, colorSchemeShown)).toBe("dark")
        yield* visible(themeControl(page, pinnedDark))
        expect(yield* evaluate(page, colorSchemeShown)).toBe("dark")
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a reader who chose light on a dark system is served the light shell, and the app keeps it light", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ colorScheme: "dark" })
        yield* goto(page, "/")
        yield* visible(themeControl(page, "Following system, currently dark — switch to light mode"))
        yield* eventually(evaluate(page, colorSchemeShown), "dark")

        yield* click(themeControl(page, followingSystem))
        yield* visible(themeControl(page, pinnedLight))
        yield* eventually(evaluate(page, colorSchemeShown), "light")

        yield* gotoParsed(page, "/")
        expect(yield* evaluate(page, colorSchemeShown)).toBe("light")
        yield* visible(themeControl(page, pinnedLight))
        expect(yield* evaluate(page, colorSchemeShown)).toBe("light")
        expect(yield* failures).toEqual([])
      }))
  }
)
