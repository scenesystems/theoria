import * as Arr from "effect/Array"

import { renderTrials } from "../../../contracts/demo/imagined-place-arrangement.js"
import type { PlaceRenderFrame } from "../../atoms/imagined-place-render.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Layer } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { renderProgressText } from "./placeViewModel.js"

const width = 176
const height = 36
const inset = 3

const searchTone = toneClassesFor("search")

type Point = {
  readonly x: number
  readonly y: number
}

type Trace = {
  readonly trials: ReadonlyArray<Point>
  readonly best: string
}

/** A running minimum: the loss the search would report after each trial. */
const runningBest = (losses: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.scan(losses, Number.POSITIVE_INFINITY, (best, loss) => Math.min(best, loss)).slice(1)

/**
 * Every trial at its loss, and the best-so-far as a step line beneath them.
 * The x axis is the whole trial budget, so the trace fills in left to right
 * while the search runs and stays put when it stops.
 */
const traceFor = (losses: ReadonlyArray<number>): Trace => {
  // Log scale: early trials can be ten times worse than the best, and a linear
  // axis would flatten the part of the search worth seeing.
  const scaled = Arr.map(losses, (loss) => Math.log(Math.max(loss, Number.EPSILON)))
  const max = Math.max(...scaled, 0)
  const min = Math.min(...scaled, max)
  const range = max - min || 1
  const step = renderTrials <= 1 ? 0 : (width - inset * 2) / (renderTrials - 1)
  const x = (index: number): number => inset + index * step
  const y = (loss: number): number =>
    height - inset - ((Math.log(Math.max(loss, Number.EPSILON)) - min) / range) * (height - inset * 2)
  const trials = Arr.map(losses, (loss, index) => ({ x: x(index), y: y(loss) }))
  const best = Arr.join(
    Arr.map(
      runningBest(losses),
      (loss, index) =>
        `${index === 0 ? "M" : "H"}${x(index).toFixed(1)}${
          index === 0 ? ` ${y(loss).toFixed(1)}` : ` V${y(loss).toFixed(1)}`
        }`
    ),
    " "
  )
  return { trials, best }
}

const TraceChart = ({ losses }: { readonly losses: ReadonlyArray<number> }) => {
  const trace = traceFor(losses)
  return (
    <svg
      aria-hidden
      className="h-9 w-44 shrink-0 overflow-visible"
      preserveAspectRatio="none"
      viewBox={`0 0 ${String(width)} ${String(height)}`}
    >
      <path
        className={`fill-none ${searchTone.stroke} motion-reduce:transition-none`}
        d={trace.best}
        strokeLinejoin="miter"
        strokeWidth={2}
      />
      {Arr.map(trace.trials, (point, index) => (
        <circle
          className={searchTone.fillMuted}
          cx={point.x.toFixed(1)}
          cy={point.y.toFixed(1)}
          key={index}
          opacity={0.85}
          r={2}
        />
      ))}
    </svg>
  )
}

/** The search as it happened: every trial's loss, the running best, and where it stands now. */
export const PlaceSearchTrace = ({ frame }: { readonly frame: PlaceRenderFrame }) => (
  <Layer
    className="grid grid-cols-1 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-x-3"
    data-place-render-phase={frame.phase}
  >
    <TraceChart losses={frame.losses} />
    <SemanticText
      as="span"
      className="min-w-0 truncate tabular-nums text-ink-500"
      role="code-meta"
      text={renderProgressText(frame)}
    />
  </Layer>
)
