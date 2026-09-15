import { Button } from "@base-ui/react/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ComputerDesktopIcon, MoonIcon, SunIcon } from "@heroicons/react/20/solid"
import { Match, Schema } from "effect"

import type { ColorModePreference } from "../../../contracts/color-mode.js"
import type { ColorMode } from "../../../contracts/palette.js"
import { colorModeAtom, colorModePreferenceAtom } from "../../atoms/theme.js"

import { headerChromeGlyphClassName, headerChromeIconButtonClassName } from "./HeaderChrome.js"

/** The cycle: follow the system, then pin light, then pin dark, then follow the system again. */
export const nextPreference = (preference: ColorModePreference): ColorModePreference =>
  Match.value(preference).pipe(
    Match.when("system", (): ColorModePreference => "light"),
    Match.when("light", (): ColorModePreference => "dark"),
    Match.when("dark", (): ColorModePreference => "system"),
    Match.exhaustive
  )

/** Names the state the reader is in and the state one press reaches, for assistive technology. */
export const themeToggleLabel = (preference: ColorModePreference, mode: ColorMode): string =>
  Match.value(preference).pipe(
    Match.when("system", () => `Following system, currently ${mode} — switch to light mode`),
    Match.when("light", () => "Light mode — switch to dark mode"),
    Match.when("dark", () => "Dark mode — follow the system"),
    Match.exhaustive
  )

/** The glyph the control wears: a screen while following the system, the sun pinned light, the moon pinned dark. */
export const ThemeToggleGlyph = Schema.Literal("screen", "sun", "moon")
export type ThemeToggleGlyph = typeof ThemeToggleGlyph.Type

/** The glyph names the preference, as the label does: following the system is its own state, not a light or a dark one. */
export const themeToggleGlyph = (preference: ColorModePreference): ThemeToggleGlyph =>
  Match.value(preference).pipe(
    Match.withReturnType<ThemeToggleGlyph>(),
    Match.when("system", () => "screen"),
    Match.when("light", () => "sun"),
    Match.when("dark", () => "moon"),
    Match.exhaustive
  )

const glyphClassName = headerChromeGlyphClassName("heroicon-20-solid")

const Glyph = ({ glyph }: { readonly glyph: ThemeToggleGlyph }) =>
  Match.value(glyph).pipe(
    Match.when("screen", () => <ComputerDesktopIcon aria-hidden className={glyphClassName} />),
    Match.when("sun", () => <SunIcon aria-hidden className={glyphClassName} />),
    Match.when("moon", () => <MoonIcon aria-hidden className={glyphClassName} />),
    Match.exhaustive
  )

/**
 * Cycles the reader's preference through system → light → dark → system. The
 * glyph and the label both name the preference, so a reader following the
 * system sees that they are, and can get back to it.
 */
export const ThemeToggle = () => {
  const preference = useAtomValue(colorModePreferenceAtom)
  const mode = useAtomValue(colorModeAtom)
  const setPreference = useAtomSet(colorModePreferenceAtom)
  const glyph = themeToggleGlyph(preference)

  return (
    <Button
      aria-label={themeToggleLabel(preference, mode)}
      className={headerChromeIconButtonClassName()}
      data-theme-glyph={glyph}
      onClick={() => setPreference(nextPreference(preference))}
      type="button"
    >
      <Glyph glyph={glyph} />
    </Button>
  )
}
