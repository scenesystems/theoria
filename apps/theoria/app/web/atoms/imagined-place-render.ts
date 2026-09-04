import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Study } from "@scenesystems/effect-search"
import { Data, Duration, Effect, Option, Ref, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import {
  arrange,
  Arrangement,
  descriptionInput,
  meanderSpace,
  renderingFor,
  renderSampler,
  renderTrials
} from "../../contracts/demo/imagined-place-arrangement.js"
import { type Stage, stageFor } from "../../contracts/demo/imagined-place-flow.js"
import type { PlaceRendering } from "../../contracts/imagined-place-result.js"
import type { PlaceArtifact } from "../../contracts/imagined-place.js"
import { type BrowserTextLayout, browserTextLayoutLive } from "../text/browserTextLayout.js"
import { type MarkerLabelWidths, markerLabelWidths } from "../view/home/placeMarkerLabels.js"
import { prepareBrowserText } from "../view/text/authority.js"

import { placeArtifactAtom, placeStageWidthAtom } from "./imagined-place.js"

/**
 * Draws the place in the browser with the browser's own font metrics.
 *
 * This is the same search the server runs in `server/imagined-place/render.ts`
 * (same seed, same trial budget, same objective), driven step by step with
 * `Study.ask`/`Study.tell` so the page can show the arrangement improving.
 * Every frame is the best arrangement found so far.
 */
export class PlaceRenderFrame extends Data.Class<{
  readonly phase: "running" | "complete"
  readonly trial: number
  readonly stage: Stage
  /** Every arrangement so far, in the order the search tried them. */
  readonly tried: ReadonlyArray<Arrangement>
  /** Index into `tried` of the best so far: the one `rendering` draws. */
  readonly bestIndex: number
  readonly rendering: PlaceRendering
  /** The discs that carry their names at this stage width, and how wide each name wraps. */
  readonly labels: MarkerLabelWidths
}> {}

/** The loss of every trial so far: the trace of the search. */
export const frameLosses = (frame: PlaceRenderFrame): ReadonlyArray<number> =>
  Arr.map(frame.tried, (arrangement) => arrangement.quality.loss)

/** The same frame drawn with the trial at `index` instead of the best; out of range draws the best. */
export const frameShowing = (frame: PlaceRenderFrame, index: Option.Option<number>): PlaceRenderFrame =>
  Option.match(Option.flatMap(index, (value) => Arr.get(frame.tried, value)), {
    onNone: () => frame,
    onSome: (arrangement) =>
      new PlaceRenderFrame({
        ...frame,
        rendering: renderingFor({
          arrangement,
          bestLoss: frame.rendering.evidence.bestLoss,
          stage: frame.stage,
          trials: frame.trial
        })
      })
  })

const renderRuntime = Atom.runtime(browserTextLayoutLive)

/** Long enough to see the markers settle, short enough that 36 trials finish in about a second. */
const frameDelay = Duration.millis(28)

const Progress = Schema.Struct({
  tried: Schema.NonEmptyArray(Arrangement),
  bestIndex: Schema.Number
})
type Progress = typeof Progress.Type

const bestOf = (progress: Progress): Arrangement => Arr.unsafeGet(progress.tried, progress.bestIndex)

const frame = (
  progress: Progress,
  stage: Stage,
  labels: MarkerLabelWidths,
  trial: number,
  phase: PlaceRenderFrame["phase"]
): PlaceRenderFrame =>
  new PlaceRenderFrame({
    phase,
    trial,
    stage,
    labels,
    tried: progress.tried,
    bestIndex: progress.bestIndex,
    rendering: renderingFor({
      arrangement: bestOf(progress),
      bestLoss: bestOf(progress).quality.loss,
      stage,
      trials: trial
    })
  })

const advance = (current: Option.Option<Progress>, arrangement: Arrangement): Progress =>
  Option.match(current, {
    onNone: () => ({ tried: Arr.of(arrangement), bestIndex: 0 }),
    onSome: (progress) => ({
      tried: Arr.append(progress.tried, arrangement),
      bestIndex: arrangement.quality.loss < bestOf(progress).quality.loss ? progress.tried.length : progress.bestIndex
    })
  })

const renderFailed = (message: string) => new DemoExecutionError({ code: "execution-failed", message, retryable: true })

const renderStream = (
  artifact: PlaceArtifact,
  stageWidth: number
): Stream.Stream<PlaceRenderFrame, DemoExecutionError, BrowserTextLayout> =>
  Study.streamFromEmitter<PlaceRenderFrame, void, DemoExecutionError, BrowserTextLayout>((emit) =>
    Effect.scoped(
      Effect.gen(function*() {
        const stage = stageFor(stageWidth)
        const prepared = yield* prepareBrowserText(descriptionInput(artifact))
        const labels = yield* markerLabelWidths(artifact, stage)
        const candidate = arrange(artifact, prepared, stage)
        const space = yield* meanderSpace
        const handle = yield* Study.open({
          space,
          sampler: renderSampler(),
          objective: (meander) => Effect.succeed(candidate(meander).quality.loss),
          trials: renderTrials,
          direction: "minimize"
        })
        const progressRef = yield* Ref.make(Option.none<Progress>())

        yield* Effect.forEach(
          Arr.range(1, renderTrials),
          (trial) =>
            Effect.gen(function*() {
              const asked = yield* Study.ask(handle)
              const arrangement = candidate(asked.config)
              const loss = arrangement.quality.loss
              yield* Study.tell(handle, asked.trialNumber, loss)

              const progress = yield* Ref.updateAndGet(
                progressRef,
                (current) => Option.some(advance(current, arrangement))
              )
              yield* Option.match(progress, {
                onNone: () => Effect.void,
                onSome: (found) =>
                  emit(frame(found, stage, labels, trial, trial === renderTrials ? "complete" : "running"))
              })
              yield* Effect.sleep(frameDelay)
            }),
          { concurrency: 1, discard: true }
        )
      })
    ).pipe(Effect.mapError((cause) => renderFailed(String(cause))))
  )

/**
 * The trial the visitor chose to look at from the search trace, if any. The
 * stage draws it in place of the best, so a rejected arrangement can be seen
 * as the search saw it.
 */
export const placeTrialPreviewAtom: AtomType.Writable<Option.Option<number>> = Atom.make(Option.none<number>())

/**
 * The latest frame for the current artifact at the current stage width. A new
 * artifact or a new width starts a new search; the previous frame is kept
 * while it runs so the stage never blanks.
 */
export const placeRenderFrameAtom: AtomType.Atom<Result.Result<PlaceRenderFrame, DemoExecutionError>> = renderRuntime
  .atom((get: AtomType.Context) => {
    const artifact = get(placeArtifactAtom)
    const stageWidth = get(placeStageWidthAtom)
    // A new search means new trials; a trial chosen from the old one no longer exists.
    get.set(placeTrialPreviewAtom, Option.none())
    return Option.match(artifact, {
      onNone: () => Stream.empty,
      onSome: (value) => renderStream(value, stageWidth)
    })
  })

/** The frame the stage draws: the best arrangement, or the trial the visitor chose. */
export const placeShownFrameAtom: AtomType.Atom<Result.Result<PlaceRenderFrame, DemoExecutionError>> = Atom.make(
  (get: AtomType.Context) => {
    const preview = get(placeTrialPreviewAtom)
    return Result.map(get(placeRenderFrameAtom), (found) => frameShowing(found, preview))
  }
)
