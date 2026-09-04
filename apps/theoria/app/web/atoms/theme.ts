import { Atom } from "@effect-atom/atom"
import { Option, Schema } from "effect"

export const ColorMode = Schema.Literal("light", "dark")

export type ColorMode = typeof ColorMode.Type

const STORAGE_KEY = "theoria-color-mode"

const systemPreference = (): ColorMode =>
  globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

/** The stored choice wins; otherwise the operating system's preference. Browser-only: the app never renders on a server. */
const readStoredPreference = (): ColorMode =>
  Option.fromNullable(globalThis.localStorage.getItem(STORAGE_KEY)).pipe(
    Option.filter(Schema.is(ColorMode)),
    Option.getOrElse(systemPreference)
  )

export const colorModeAtom = Atom.make<ColorMode>(readStoredPreference())

export const persistColorMode = (mode: ColorMode): void => {
  globalThis.localStorage.setItem(STORAGE_KEY, mode)
}
