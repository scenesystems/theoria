import { Button } from "@base-ui-components/react/button"
import { Match } from "effect"
import * as Option from "effect/Option"
import type { KeyboardEvent, PointerEvent, ReactNode } from "react"
import { useRef } from "react"

import { Layer } from "../primitives/Layout.js"

const nextPercentFromKey = ({
  firstPanePercent,
  key,
  maxPercent,
  minPercent
}: {
  readonly firstPanePercent: number
  readonly key: string
  readonly maxPercent: number
  readonly minPercent: number
}): number | null =>
  Match.value(key).pipe(
    Match.when("ArrowLeft", () => firstPanePercent - 4),
    Match.when("ArrowRight", () => firstPanePercent + 4),
    Match.when("Home", () => minPercent),
    Match.when("End", () => maxPercent),
    Match.orElse(() => null)
  )

// ---------------------------------------------------------------------------
// Collapse-based pane visibility.
//
// Tailwind v4 makes `hidden` + `lg:flex` unreliable — CSS generation order
// decides which `display` wins. Collapsing to zero size with `invisible` +
// `overflow-hidden` + `pointer-events-none` avoids the conflict.
//
// When the second pane is visible, desktop keeps the split active while
// narrow layouts choose between the first and second panes.
// When the second pane is hidden, the first pane fills the workspace at
// every breakpoint.
// ---------------------------------------------------------------------------

const paneBase = "min-h-0 min-w-0 flex flex-col lg:h-full"
const paneSplit = "lg:shrink-0 lg:basis-[var(--split-pane-size)]"
const collapsed =
  "invisible max-h-0 lg:max-h-none lg:max-w-none overflow-hidden pointer-events-none lg:visible lg:overflow-visible lg:pointer-events-auto"
const hidden =
  "invisible max-h-0 max-w-0 overflow-hidden pointer-events-none lg:invisible lg:max-h-0 lg:max-w-0 lg:overflow-hidden lg:pointer-events-none"
const expanded = "flex-1 lg:flex-none"
const solo = "flex-1"

export const SplitPane = ({
  ariaLabel = "Resize workspace panels",
  compactActivePane = "first",
  dividerClassName,
  first,
  firstPanePercent,
  handleClassName,
  maxPercent,
  minPercent,
  onFirstPanePercentChange,
  second,
  secondPaneVisible = false
}: {
  readonly ariaLabel?: string
  readonly compactActivePane?: "first" | "second"
  readonly dividerClassName: string
  readonly first: ReactNode
  readonly firstPanePercent: number
  readonly handleClassName: string
  readonly maxPercent: number
  readonly minPercent: number
  readonly onFirstPanePercentChange: (percent: number) => void
  readonly second: ReactNode
  readonly secondPaneVisible?: boolean
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const updatePercentFromClientX = (clientX: number): void => {
    Option.fromNullable(containerRef.current).pipe(
      Option.map((element) => element.getBoundingClientRect()),
      Option.filter((rect) => rect.width > 0),
      Option.map((rect) => ((clientX - rect.left) / rect.width) * 100),
      Option.map((percent) => Math.max(minPercent, Math.min(maxPercent, percent))),
      Option.match({
        onNone: () => undefined,
        onSome: onFirstPanePercentChange
      })
    )
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    updatePercentFromClientX(event.clientX)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      updatePercentFromClientX(event.clientX)
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const nextPercent = nextPercentFromKey({
      firstPanePercent,
      key: event.key,
      maxPercent,
      minPercent
    })

    if (nextPercent !== null) {
      event.preventDefault()
      onFirstPanePercentChange(nextPercent)
    }
  }

  const firstClass = `${paneBase} ${
    secondPaneVisible ? `${paneSplit} ${compactActivePane === "second" ? collapsed : expanded}` : solo
  }`
  const secondClass = `${paneBase} ${
    secondPaneVisible ? `${paneSplit} ${compactActivePane === "second" ? expanded : collapsed}` : hidden
  }`

  const paneStyle = (percent: number): Record<string, string> => ({
    "--split-pane-size": `${percent}%`
  })

  return (
    <Layer className="min-h-0 h-full flex flex-1 flex-col lg:flex-row" ref={containerRef}>
      <Layer className={firstClass} style={paneStyle(firstPanePercent)}>
        {first}
      </Layer>

      <Button
        aria-label={ariaLabel}
        className={`relative shrink-0 w-0 overflow-hidden pointer-events-none ${
          secondPaneVisible
            ? "lg:w-px lg:overflow-visible lg:pointer-events-auto lg:cursor-col-resize"
            : "lg:w-0 lg:overflow-hidden lg:pointer-events-none"
        } ${dividerClassName}`}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        type="button"
      >
        <Layer className={`absolute inset-x-[-0.55rem] inset-y-0 ${handleClassName}`} />
      </Button>

      <Layer className={secondClass} style={paneStyle(100 - firstPanePercent)}>
        {second}
      </Layer>
    </Layer>
  )
}
