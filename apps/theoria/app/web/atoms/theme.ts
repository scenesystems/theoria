import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Boolean as Bool, Match, Stream } from "effect"

import { colorModeCookieName, ColorModePreference, darkRootClass, isDark } from "../../contracts/color-mode.js"
import { type ColorMode } from "../../contracts/palette.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserWindow from "../platform/BrowserWindow.js"
import { appRuntime } from "./runtime.js"

export { ColorModePreference } from "../../contracts/color-mode.js"

/**
 * The persisted preference, kept as the colour-mode cookie through the
 * platform `KeyValueStore`, so the Worker serves the next page already in
 * this mode. Readers who never chose follow the system.
 */
export const colorModePreferenceAtom: AtomType.Writable<ColorModePreference> = Atom.kvs({
  runtime: appRuntime,
  key: colorModeCookieName,
  schema: ColorModePreference,
  defaultValue: (): ColorModePreference => "system"
})

const systemColorModeAtom: AtomType.Atom<Result.Result<ColorMode>> = appRuntime.atom(
  BrowserWindow.mediaQuery("(prefers-color-scheme: dark)").pipe(
    Stream.map(Bool.match({ onTrue: (): ColorMode => "dark", onFalse: (): ColorMode => "light" }))
  )
)

/** The mode in effect: the fixed preference, or the live system mode when the reader follows the system. */
export const colorModeAtom: AtomType.Atom<ColorMode> = Atom.make((get) =>
  Match.value(get(colorModePreferenceAtom)).pipe(
    Match.when("system", () => Result.getOrElse(get(systemColorModeAtom), (): ColorMode => "light")),
    Match.orElse((fixed) => fixed)
  )
)

/** Keeps the `dark` class on `<html>` in step with the mode; mount once at the app root. */
export const colorModeApplicationAtom: AtomType.Atom<Result.Result<void>> = appRuntime.atom((get) =>
  BrowserDocument.toggleRootClass(darkRootClass, isDark(get(colorModeAtom)))
)
