import type { Cookies } from "@effect/platform"
import { DateTime, Duration, Equal, Option, Schema } from "effect"

import { type HeadEntry, HeadRootClass } from "./head.js"
import type { ColorMode } from "./palette.js"

/**
 * The reader's colour-mode preference, and how the browser and the Worker
 * share it. The preference travels as a cookie so the Worker can serve the
 * shell already in the reader's mode: the page's first frame is the right
 * colour without a script, which the Content Security Policy forbids inline.
 * The browser keeps the same cookie through the platform `KeyValueStore`, so
 * `Atom.kvs` reads and writes it as it would any store.
 */

/** What the reader asked for: a fixed mode, or whatever the operating system says, followed live. */
export const ColorModePreference = Schema.Literal("system", "light", "dark")

export type ColorModePreference = typeof ColorModePreference.Type

/** The cookie's name; a token, so it needs no quoting on the wire. */
export const colorModeCookieName = "theoria-color-mode"

/** A year: long enough that a returning reader is served their mode, short enough to forget one who left. */
export const colorModeCookieLifetime: Duration.Duration = Duration.days(365)

/**
 * How the cookie travels: site-wide, first-party only, alive for a year. It
 * carries no secret, so it is neither `HttpOnly` (the browser writes it) nor
 * bound to a session.
 */
export const colorModeCookieOptions: Cookies.Cookie["options"] = {
  path: "/",
  maxAge: colorModeCookieLifetime,
  sameSite: "lax"
}

/**
 * The same cookie with its life over, so the browser drops it on write. Both
 * `Max-Age` and `Expires` are set: every browser honours the first, and every
 * DOM host honours the second.
 */
export const preferenceCookieRemoval: Cookies.Cookie["options"] = {
  path: "/",
  maxAge: Duration.zero,
  expires: DateTime.toDate(DateTime.unsafeMake(0)),
  sameSite: "lax"
}

/**
 * The cookie as the Worker reads it from a request: the preference, JSON
 * encoded as the `KeyValueStore`'s schema store writes it, or absent. A
 * malformed value fails to decode and is treated as absent by the caller.
 */
export const ColorModeCookies = Schema.Struct({
  [colorModeCookieName]: Schema.optionalWith(Schema.parseJson(ColorModePreference), { as: "Option" })
})

/** The class on `<html>` that switches the palette to its dark values; light is its absence. */
export const darkRootClass = "dark"

/** Whether a mode wears the dark class. */
export const isDark = (mode: ColorMode): boolean => Equal.equals(mode, "dark")

/**
 * The root class the Worker serves for a preference: `dark` for a reader who
 * chose dark; nothing for light, for following the system (the browser reads
 * the system's mode itself), or for no preference at all.
 */
export const rootClassForPreference = (preference: Option.Option<ColorModePreference>): HeadEntry =>
  HeadRootClass.make({
    name: darkRootClass,
    present: Option.exists(preference, (chosen) => Equal.equals(chosen, "dark"))
  })
