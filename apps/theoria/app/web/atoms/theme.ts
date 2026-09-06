import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match, Schema, Stream } from "effect"

import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserWindow from "../platform/BrowserWindow.js"
import { appRuntime } from "./runtime.js"

export const ColorMode = Schema.Literal("light", "dark")

export type ColorMode = typeof ColorMode.Type

/** What the reader asked for: a fixed mode, or whatever the operating system says, followed live. */
export const ColorModePreference = Schema.Literal("system", "light", "dark")

export type ColorModePreference = typeof ColorModePreference.Type

/**
 * The persisted preference, kept in the browser's local storage through the
 * platform `KeyValueStore`. Readers who never chose follow the system.
 */
export const colorModePreferenceAtom: AtomType.Writable<ColorModePreference> = Atom.kvs({
  runtime: appRuntime,
  key: "theoria/color-mode-preference",
  schema: ColorModePreference,
  defaultValue: (): ColorModePreference => "system"
})

const systemColorModeAtom: AtomType.Atom<Result.Result<ColorMode>> = appRuntime.atom(
  BrowserWindow.mediaQuery("(prefers-color-scheme: dark)").pipe(
    Stream.map((dark): ColorMode => dark ? "dark" : "light")
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
  BrowserDocument.toggleRootClass("dark", get(colorModeAtom) === "dark")
)
