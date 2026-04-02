import { Button } from "@base-ui-components/react/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { MoonIcon, SunIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"

import { type ColorMode, colorModeAtom, persistColorMode } from "../../atoms/theme.js"

import { chromeHeaderGlyphClassName, chromeIconButtonClassName } from "./ChromeIconButton.js"

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
      className={chromeIconButtonClassName({ active: false, className: "h-11 w-11 rounded-[1rem]" })}
      onClick={toggle}
      type="button"
    >
      {Match.value(mode).pipe(
        Match.when("light", () => <MoonIcon aria-hidden className={chromeHeaderGlyphClassName} />),
        Match.when("dark", () => <SunIcon aria-hidden className={chromeHeaderGlyphClassName} />),
        Match.exhaustive
      )}
    </Button>
  )
}
