import { Button } from "@base-ui-components/react/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { MoonIcon, SunIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"

import { type ColorMode, colorModeAtom, persistColorMode } from "../../atoms/theme.js"

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
    <Button
      aria-label={Match.value(mode).pipe(
        Match.when("light", () => "Switch to dark mode"),
        Match.when("dark", () => "Switch to light mode"),
        Match.exhaustive
      )}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stage-300 bg-stage-0/96 text-ink-700 shadow-chip transition-colors duration-150 hover:border-stage-400 hover:bg-stage-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1"
      onClick={toggle}
      type="button"
    >
      {Match.value(mode).pipe(
        Match.when("light", () => <MoonIcon aria-hidden className="h-4 w-4" />),
        Match.when("dark", () => <SunIcon aria-hidden className="h-4 w-4" />),
        Match.exhaustive
      )}
    </Button>
  )
}
