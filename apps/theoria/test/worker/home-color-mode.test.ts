// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { BrowserContext, Page } from "@playwright/test"
import { DateTime, Duration, Effect, Equal, Layer, Option } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"

import { colorModeCookieName } from "../../app/contracts/color-mode.js"
import { act, BrowserLive, click, eventually, goto, gotoParsed, openPage, setColorScheme, visible } from "./browser.js"
import { colorSchemeShown } from "./platform/in-page.js"
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

/** The colour-mode cookie as the browser holds it for the site, if it does. */
const preferenceCookie = (context: BrowserContext) =>
  Effect.map(
    act(() => context.cookies()),
    (cookies) => Arr.findFirst(cookies, (cookie) => Equal.equals(cookie.name, colorModeCookieName))
  )

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "3 minutes" })(
  "Theoria colour mode in Chromium",
  (it) => {
    it.scoped("the control cycles system → light → dark → system, and following the system follows it live", () =>
      Effect.gen(function*() {
        const { context, failures, page } = yield* openPage({ colorScheme: "light" })
        yield* goto(page, "/")

        // A first visit follows the system, which is light: no cookie yet says otherwise.
        yield* visible(themeControl(page, "Following system, currently light — switch to light mode"))
        expect(yield* act(() => page.evaluate(colorSchemeShown))).toBe("light")

        yield* click(themeControl(page, followingSystem))
        yield* visible(themeControl(page, pinnedLight))
        expect(yield* act(() => page.evaluate(colorSchemeShown))).toBe("light")

        yield* click(themeControl(page, pinnedLight))
        yield* visible(themeControl(page, pinnedDark))
        yield* eventually(() => page.evaluate(colorSchemeShown), "dark")

        // Pinned dark, the system's scheme changing means nothing to the page.
        yield* act(() => page.emulateMedia({ colorScheme: "light" }))
        expect(yield* act(() => page.evaluate(colorSchemeShown))).toBe("dark")

        // The third press returns to following the system, and the page follows a flipped system at once.
        yield* click(themeControl(page, pinnedDark))
        yield* visible(themeControl(page, "Following system, currently light — switch to light mode"))
        yield* eventually(() => page.evaluate(colorSchemeShown), "light")
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
        expect(yield* act(() => page.evaluate(colorSchemeShown))).toBe("dark")
        yield* visible(themeControl(page, pinnedDark))
        expect(yield* act(() => page.evaluate(colorSchemeShown))).toBe("dark")
        expect(yield* failures).toEqual([])
      }))

    it.scoped("a reader who chose light on a dark system is served the light shell, and the app keeps it light", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ colorScheme: "dark" })
        yield* goto(page, "/")
        yield* visible(themeControl(page, "Following system, currently dark — switch to light mode"))
        yield* eventually(() => page.evaluate(colorSchemeShown), "dark")

        yield* click(themeControl(page, followingSystem))
        yield* visible(themeControl(page, pinnedLight))
        yield* eventually(() => page.evaluate(colorSchemeShown), "light")

        yield* gotoParsed(page, "/")
        expect(yield* act(() => page.evaluate(colorSchemeShown))).toBe("light")
        yield* visible(themeControl(page, pinnedLight))
        expect(yield* act(() => page.evaluate(colorSchemeShown))).toBe("light")
        expect(yield* failures).toEqual([])
      }))
  }
)
