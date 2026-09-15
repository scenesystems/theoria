import { describe, expect, it } from "@effect/vitest"
import { Effect, Function as Fn } from "effect"
import * as Arr from "effect/Array"

import { ColorModePreference } from "../../app/contracts/color-mode.js"
import { nextPreference, themeToggleGlyph, themeToggleLabel } from "../../app/web/view/primitives/ThemeToggle.js"

describe("the theme toggle", () => {
  it.effect("cycles through every preference and returns to following the system", () =>
    Effect.sync(() => {
      expect(nextPreference("system")).toBe("light")
      expect(nextPreference("light")).toBe("dark")
      expect(nextPreference("dark")).toBe("system")

      // Three presses from anywhere land back where the reader started: nothing is unreachable.
      const threePresses = Fn.compose(Fn.compose(nextPreference, nextPreference), nextPreference)
      expect(Arr.map(ColorModePreference.literals, threePresses)).toStrictEqual(ColorModePreference.literals)
    }))

  it.effect("names the preference and the mode in effect, and what one press does", () =>
    Effect.sync(() => {
      expect(themeToggleLabel("system", "dark")).toBe("Following system, currently dark — switch to light mode")
      expect(themeToggleLabel("system", "light")).toBe("Following system, currently light — switch to light mode")
      expect(themeToggleLabel("light", "light")).toBe("Light mode — switch to dark mode")
      expect(themeToggleLabel("dark", "dark")).toBe("Dark mode — follow the system")
    }))

  it.effect("wears a glyph per preference, so following the system is never mistaken for a pinned mode", () =>
    Effect.sync(() => {
      expect(themeToggleGlyph("system")).toBe("screen")
      expect(themeToggleGlyph("light")).toBe("sun")
      expect(themeToggleGlyph("dark")).toBe("moon")
      expect(Arr.dedupe(Arr.map(ColorModePreference.literals, themeToggleGlyph))).toHaveLength(
        Arr.length(ColorModePreference.literals)
      )
    }))
})
