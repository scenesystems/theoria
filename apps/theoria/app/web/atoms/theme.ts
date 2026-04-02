import { Atom } from "@effect-atom/atom"
import { Schema } from "effect"

export const ColorMode = Schema.Literal("light", "dark")

export type ColorMode = typeof ColorMode.Type

const STORAGE_KEY = "theoria-color-mode"

const readStoredPreference = (): ColorMode => {
  if (typeof window === "undefined") return "light"
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (Schema.is(ColorMode)(stored)) return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export const colorModeAtom = Atom.make<ColorMode>(readStoredPreference())

export const persistColorMode = (mode: ColorMode): void => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, mode)
  }
}
