import { Slider } from "@base-ui/react/slider"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option, Schema } from "effect"
import * as Arr from "effect/Array"
import type { CSSProperties } from "react"

import { renderTrials } from "../../../contracts/demo/imagined-place-arrangement.js"
import { frameLosses, type PlaceRenderFrame, placeTrialPreviewAtom } from "../../atoms/imagined-place-render.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Layer } from "../primitives/Layout.js"

import { shownTrialIndex, trialValueText } from "./placeViewModel.js"

const searchTone = toneClassesFor("search")

const Point = Schema.Struct({ x: Schema.Number, y: Schema.Number })
type Point = typeof Point.Type

/** A running minimum: the loss the search would report after each trial. */
const runningBest = (losses: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.scan(losses, Number.POSITIVE_INFINITY, (best, loss) => Math.min(best, loss)).slice(1)

/**
 * Every trial at its loss, in percent of the chart: x over the whole trial
 * budget so the trace fills in left to right and stays put when the search
 * stops, y on a log scale because early trials can be ten times worse than
 * the best and a linear axis would flatten the part worth seeing.
 */
const pointsFor = (losses: ReadonlyArray<number>): ReadonlyArray<Point> => {
  const scaled = Arr.map(losses, (loss) => Math.log(Math.max(loss, Number.EPSILON)))
  const max = Math.max(...scaled, 0)
  const min = Math.min(...scaled, max)
  const range = max - min || 1
  const step = renderTrials <= 1 ? 0 : 100 / (renderTrials - 1)
  return Arr.map(scaled, (value, index) => ({ x: index * step, y: 100 - ((value - min) / range) * 100 }))
}

/** The best-so-far as a step line: horizontal until a better trial, then straight down to it. */
const bestPath = (losses: ReadonlyArray<number>): string =>
  Arr.join(
    Arr.map(pointsFor(runningBest(losses)), (point, index) =>
      index === 0
        ? `M${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        : `H${point.x.toFixed(2)} V${point.y.toFixed(2)}`),
    " "
  )

const dotStyle = (point: Point): CSSProperties => ({ left: `${point.x.toFixed(2)}%`, top: `${point.y.toFixed(2)}%` })

const dotClassName = (kind: "tried" | "best" | "shown"): string =>
  kind === "best"
    ? `absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-stage-0 ${searchTone.bg}`
    : kind === "shown"
    ? "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-900 ring-2 ring-stage-0"
    : `absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 ${searchTone.dot}`

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
          className={dotClassName(index === shown ? "shown" : index === best ? "best" : "tried")}
          data-place-trial={String(index)}
          key={index}
          style={dotStyle(point)}
        />
      ))}
    </Layer>
  )
}

const thumbClassName =
  "group flex h-full w-5 cursor-ew-resize items-center justify-center outline-none data-[disabled]:cursor-default"

const thumbLineClassName =
  "pointer-events-none block h-full w-0.5 rounded-full bg-ink-900/55 transition-[background-color,box-shadow] duration-150 group-hover:bg-ink-900 group-has-[:focus-visible]:bg-ink-900 group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-ink-900/25 group-data-[disabled]:bg-ink-900/25"

/**
 * The search as it happened, and a way to look at any of it. Each dot is an
 * arrangement the search tried; the step line is the best so far; the thumb
 * is the trial drawn on the stage. Drag or use the arrow keys to see the
 * arrangements the search rejected, drawn exactly as it scored them. While
 * the search runs the thumb follows the best so far.
 */
export const PlaceSearchTrace = ({ frame }: { readonly frame: PlaceRenderFrame }) => {
  const preview = useAtomValue(placeTrialPreviewAtom)
  const setPreview = useAtomSet(placeTrialPreviewAtom)
  const losses = frameLosses(frame)
  const shown = shownTrialIndex(frame, preview)
  const running = frame.phase === "running"

  return (
    <Slider.Root
      className="w-full"
      data-place-render-phase={frame.phase}
      data-place-trace
      disabled={running}
      max={renderTrials - 1}
      min={0}
      // On the root, not the thumb: Base UI 1.0.0-rc.0 drops the thumb's own onKeyDown.
      onKeyDown={(event) => {
        // Escape leaves the excursion: back to the trial the search kept.
        if (event.key === "Escape") setPreview(Option.none())
      }}
      onValueChange={(value) => {
        setPreview(value === frame.bestIndex ? Option.none() : Option.some(value))
      }}
      step={1}
      value={shown}
    >
      <Slider.Control className="relative h-16 w-full cursor-pointer touch-none select-none data-[disabled]:cursor-default">
        <TraceChart best={frame.bestIndex} losses={losses} shown={shown} />
        <Slider.Thumb
          className={thumbClassName}
          getAriaLabel={() => "Trial drawn on the stage"}
          getAriaValueText={(_, value) => trialValueText(frame, value)}
        >
          <Layer render={<span />} className={thumbLineClassName} />
        </Slider.Thumb>
      </Slider.Control>
    </Slider.Root>
  )
}
