import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { MoonIcon, SunIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"

import { type ColorMode, colorModeAtom, persistColorMode } from "../../atoms/theme.js"
import { IconButton } from "../components/action/IconButton.js"

const opposite = (mode: ColorMode): ColorMode =>
  Match.value(mode).pipe(
    Match.when("light", (): ColorMode => "dark"),
    Match.when("dark", (): ColorMode => "light"),
    Match.exhaustive
  )

export const ThemeToggle = () => {
  const mode = useAtomValue(colorModeAtom)
  const setMode = useAtomSet(colorModeAtom)

  const toggle = () => {
    const next = opposite(mode)
    setMode(next)
    persistColorMode(next)
  }

  return (
    <IconButton
      label={Match.value(mode).pipe(
        Match.when("light", () => "Switch to dark mode"),
        Match.when("dark", () => "Switch to light mode"),
        Match.exhaustive
      )}
      onClick={toggle}
      size="md"
      source={Match.value(mode).pipe(
        Match.when("light", () => MoonIcon),
        Match.when("dark", () => SunIcon),
        Match.exhaustive
      )}
      tone="ghost"
    />
  )
}
