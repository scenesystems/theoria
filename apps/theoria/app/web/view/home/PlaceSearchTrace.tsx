import { Slider } from "@base-ui/react/slider"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Boolean as Bool, Equal, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import type { CSSProperties } from "react"

import * as Numeric from "@scenesystems/effect-math/Numeric"

import { renderTrials } from "../../../contracts/demo/imagined-place-search.js"
import {
  type PlaceSearch,
  placeTrialPreviewAtom,
  type PlaceWait,
  searchLosses
} from "../../atoms/imagined-place-render.js"
import { focusEdgeClassName, toneClassesFor, transitionClassName } from "../primitives/designSystem.js"
import { Layer } from "../primitives/Layout.js"
import { ShimmerLine } from "../primitives/Skeleton.js"

import {
  fixedDecimal,
  isFirst,
  isKept,
  searching,
  shownTrialIndex,
  trialValueText,
  waitMotion
} from "./placeViewModel.js"

const searchTone = toneClassesFor("primary")

const Point = Schema.Struct({ x: Schema.Number, y: Schema.Number })
type Point = typeof Point.Type

/** A running minimum: the loss the search would report after each trial. */
const runningBest = (losses: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.drop(Arr.scan(losses, Number.POSITIVE_INFINITY, Num.min), 1)

/** The chart's width per trial: the whole budget across a hundred percent, or nothing to step by for a budget of one. */
const trialStep: number = Bool.match(Num.lessThanOrEqualTo(renderTrials, 1), {
  onTrue: () => 0,
  onFalse: () => Num.unsafeDivide(100, Num.decrement(renderTrials))
})

/** A flat trace still needs a height to be drawn at: one unit, so every point stands at the bottom. */
const spanOf = (min: number, max: number): number => {
  const span = Num.subtract(max, min)
  return Bool.match(Equal.equals(span, 0), { onTrue: () => 1, onFalse: () => span })
}

/**
 * Every trial at its loss, in percent of the chart: x over the whole trial
 * budget so the trace fills in left to right and stays put when the search
 * stops, y on a log scale because early trials can be ten times worse than
 * the best and a linear axis would flatten the part worth seeing.
 */
const pointsFor = (losses: ReadonlyArray<number>): ReadonlyArray<Point> => {
  const scaled = Arr.map(losses, (loss) => Numeric.log(Num.max(loss, Number.EPSILON)))
  const max = Arr.reduce(scaled, 0, Num.max)
  const min = Arr.reduce(scaled, max, Num.min)
  const range = spanOf(min, max)
  return Arr.map(scaled, (value, index) => ({
    x: Num.multiply(index, trialStep),
    y: Num.subtract(100, Num.multiply(Num.unsafeDivide(Num.subtract(value, min), range), 100))
  }))
}

/** The best-so-far as a step line: horizontal until a better trial, then straight down to it. */
const bestPath = (losses: ReadonlyArray<number>): string =>
  Arr.join(
    Arr.map(pointsFor(runningBest(losses)), (point, index) =>
      Bool.match(isFirst(index), {
        onTrue: () => `M${fixedDecimal(point.x, 2)} ${fixedDecimal(point.y, 2)}`,
        onFalse: () => `H${fixedDecimal(point.x, 2)} V${fixedDecimal(point.y, 2)}`
      })),
    " "
  )

const dotStyle = (point: Point): CSSProperties => ({
  left: `${fixedDecimal(point.x, 2)}%`,
  top: `${fixedDecimal(point.y, 2)}%`
})

/** What a trial's dot stands for: the one drawn on the stage, the one the search kept, or one only tried. */
const DotKind = Schema.Literal("tried", "best", "shown")
type DotKind = typeof DotKind.Type

const dotKind = (index: number, best: number, shown: number): DotKind =>
  Bool.match(Equal.equals(index, shown), {
    onTrue: (): DotKind => "shown",
    onFalse: () =>
      Bool.match(Equal.equals(index, best), { onTrue: (): DotKind => "best", onFalse: (): DotKind => "tried" })
  })

const dotClassName = (kind: DotKind): string =>
  Match.value(kind).pipe(
    Match.when(
      "best",
      () => `absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper ${searchTone.bg}`
    ),
    Match.when(
      "shown",
      () => "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emphasis ring-2 ring-paper"
    ),
    Match.when(
      "tried",
      () => `absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 ${searchTone.dot}`
    ),
    Match.exhaustive
  )

/** Dots for every trial and the step line beneath them; the chosen and the kept trial stand out. */
const TraceChart = ({ best, losses, shown }: {
  readonly best: number
  readonly losses: ReadonlyArray<number>
  readonly shown: number
}) => {
  const points = pointsFor(losses)
  return (
    <Layer aria-hidden className="absolute inset-x-0 inset-y-2.5">
      <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path
          className={`fill-none ${searchTone.stroke} opacity-80`}
          d={bestPath(losses)}
          strokeLinejoin="miter"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {Arr.map(points, (point, index) => (
        <Layer
          render={<span />}
          className={dotClassName(dotKind(index, best, shown))}
          data-place-trial={String(index)}
          key={index}
          style={dotStyle(point)}
        />
      ))}
    </Layer>
  )
}

const thumbClassName =
  `group flex h-full w-5 cursor-ew-resize items-center justify-center ${focusEdgeClassName} data-[disabled]:cursor-default`

/**
 * The thumb's line answers focus on the input inside it; under forced colours
 * the ring is dropped, so the line itself turns to the system's `Highlight`.
 */
const thumbLineClassName =
  `pointer-events-none block h-full w-0.5 rounded-full bg-emphasis-mist transition-[background-color,box-shadow] ${
    transitionClassName("respond")
  } group-hover:bg-emphasis group-has-[:focus-visible]:bg-emphasis group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-focus group-data-[disabled]:bg-emphasis-mist forced-colors:bg-[CanvasText] forced-colors:group-has-[:focus-visible]:bg-[Highlight]`

/** The chart's height, shared by the trace and the rows held for it. */
export const traceHeightClassName = "h-16"

/**
 * The trace's chart before the first trial is in: its height, with a line
 * where the trace will draw — breathing while the search is on its way,
 * still when none is coming — so the first frame moves nothing below the
 * paper. The caption's row is not here: it is kept by the row that holds it
 * live.
 */
export const PlaceSearchTracePending = ({ wait }: { readonly wait: PlaceWait }) => (
  <Layer
    aria-busy={Equal.equals(wait, "pending")}
    className={`${traceHeightClassName} flex w-full items-center`}
    data-place-trace-pending={wait}
  >
    <ShimmerLine motion={waitMotion(wait)} width="w-full" />
  </Layer>
)

/**
 * The search as it happened, and a way to look at any of it. Each dot is an
 * arrangement the search tried; the step line is the best so far; the thumb
 * is the trial drawn on the stage. Drag or use the arrow keys to see the
 * arrangements the search rejected, drawn exactly as it scored them. While
 * the search runs the thumb follows the best so far.
 */
export const PlaceSearchTrace = ({ search }: { readonly search: PlaceSearch }) => {
  const preview = useAtomValue(placeTrialPreviewAtom)
  const setPreview = useAtomSet(placeTrialPreviewAtom)
  const losses = searchLosses(search)
  const shown = shownTrialIndex(search, preview)
  const running = searching(search)

  return (
    <Slider.Root
      className="w-full"
      data-place-render-phase={search.phase}
      data-place-trace
      disabled={running}
      max={Num.decrement(renderTrials)}
      min={0}
      onValueChange={(value) => {
        setPreview(
          Bool.match(isKept(search, value), { onTrue: () => Option.none(), onFalse: () => Option.some(value) })
        )
      }}
      step={1}
      value={shown}
    >
      <Slider.Control
        className={`relative ${traceHeightClassName} w-full cursor-pointer touch-none select-none data-[disabled]:cursor-default`}
      >
        <TraceChart best={search.bestIndex} losses={losses} shown={shown} />
        <Slider.Thumb
          className={thumbClassName}
          getAriaLabel={() => "Trial drawn on the stage"}
          getAriaValueText={(_, value) => trialValueText(search, value)}
          // Escape leaves the excursion: back to the trial the search kept.
          onKeyDown={(event) => {
            Bool.match(Equal.equals(event.key, "Escape"), {
              onTrue: () => setPreview(Option.none()),
              onFalse: () => undefined
            })
          }}
        >
          <Layer render={<span />} className={thumbLineClassName} />
        </Slider.Thumb>
      </Slider.Control>
    </Slider.Root>
  )
}
