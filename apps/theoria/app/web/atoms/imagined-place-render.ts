import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Study } from "@scenesystems/effect-search"
import { Data, Duration, Effect, Match, Option, Ref, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import {
  arrange,
  Arrangement,
  description,
  descriptionInput,
  meanderSpace,
  renderingFor,
  renderSampler,
  renderTrials
} from "../../contracts/demo/imagined-place-arrangement.js"
import { type Stage, stageFor } from "../../contracts/demo/imagined-place-flow.js"
import type { PlaceRendering } from "../../contracts/imagined-place-result.js"
import type { PlaceArtifact } from "../../contracts/imagined-place.js"
import type { CanvasUnavailable } from "../platform/BrowserDocument.js"
import type { BrowserTextLayout } from "../text/browserTextLayout.js"
import { type MarkerLabelWidths, markerLabelWidths } from "../view/home/placeMarkerLabels.js"
import { prepareBrowserText } from "../view/text/authority.js"

import { placeArtifactAtom, placeStageWidthAtom } from "./imagined-place.js"
import { textLayoutRuntime } from "./text-layout.js"

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
  /** The description the lines set; a new artifact's lines replace the old ones rather than moving. */
  readonly prose: string
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
  prose: string,
  labels: MarkerLabelWidths,
  trial: number,
  phase: PlaceRenderFrame["phase"]
): PlaceRenderFrame =>
  new PlaceRenderFrame({
    phase,
    trial,
    stage,
    prose,
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
                  emit(
                    frame(
                      found,
                      stage,
                      description(artifact),
                      labels,
                      trial,
                      trial === renderTrials ? "complete" : "running"
                    )
                  )
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

const settled = (frame: PlaceRenderFrame): boolean => frame.phase === "complete"

const draws = (frame: PlaceRenderFrame, name: string): boolean =>
  Arr.some(frame.rendering.projection.markers, (marker) => marker.name === name)

const stageHeight = (frame: PlaceRenderFrame): number => frame.rendering.projection.stageHeight

/**
 * What the stage is drawing. `kept`: the arrangement the search settled on,
 * which the sheet fits exactly. `sketch`: the best arrangement so far of a
 * search still running. `trial`: one the visitor chose from the trace. Only
 * the kept arrangement is drawn unclipped; a sketch or a trial that runs
 * longer than the sheet is cut with a fade and scrolls.
 */
export const PlaceDrawn = Schema.Literal("kept", "sketch", "trial")

export type PlaceDrawn = typeof PlaceDrawn.Type

export const placeDrawnAtom: AtomType.Atom<PlaceDrawn> = Atom.make((get: AtomType.Context) =>
  Option.match(get(placeTrialPreviewAtom), {
    onSome: (): PlaceDrawn => "trial",
    onNone: () =>
      Option.match(Result.value(get(placeRenderFrameAtom)), {
        onNone: (): PlaceDrawn => "sketch",
        onSome: (found): PlaceDrawn => settled(found) ? "kept" : "sketch"
      })
  })
)

/**
 * The arrangement the last search settled on, remembered while the next one
 * runs: what the sheet is cut to and what the discs on it stand for until the
 * new arrangement is settled in turn.
 */
export const placeKeptFrameAtom: AtomType.Atom<Option.Option<PlaceRenderFrame>> = Atom.make((get: AtomType.Context) =>
  Option.orElse(
    Option.filter(Result.value(get(placeRenderFrameAtom)), settled),
    () => Option.flatten(get.self<Option.Option<PlaceRenderFrame>>())
  )
)

/**
 * The paper the stage draws on. Its width is the one the visitor chose and
 * applies at once. Its height is the settled arrangement's at that width and
 * holds while the next search runs and while trials are scrubbed, so nothing
 * around the stage moves until the arrangement is settled; until a search has
 * settled at this width, it follows the sketch.
 */
export const PlaceSheet = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number
})

export type PlaceSheet = typeof PlaceSheet.Type

export const placeSheetAtom: AtomType.Atom<Option.Option<PlaceSheet>> = Atom.make((get: AtomType.Context) => {
  const kept = get(placeKeptFrameAtom)
  return Option.map(Result.value(get(placeRenderFrameAtom)), (latest): PlaceSheet => {
    const width = latest.stage.stageWidth
    const settledHere = Option.filter(kept, (found) => found.stage.stageWidth === width)
    return PlaceSheet.make({ width, height: stageHeight(Option.getOrElse(settledHere, () => latest)) })
  })
})

/**
 * Where a feature's name belongs: on the `stage` while the feature is drawn
 * as a settled disc, in its `proposal` while it is not. A merged feature's
 * name stays in the proposal while the search makes room for it and travels
 * onto the paper when the search settles, so it lands where the feature
 * stays; a declined feature's disc leaves the moment the next search starts,
 * so the name arrives back from where the disc was. Both sides read this
 * atom, so each hand-off happens in one commit. Before anything is drawn
 * there is nowhere to travel from or to.
 */
export const PlaceFeatureHome = Schema.Literal("stage", "proposal")

export type PlaceFeatureHome = typeof PlaceFeatureHome.Type

export const placeFeatureHomeAtom = Atom.family((name: string): AtomType.Atom<Option.Option<PlaceFeatureHome>> =>
  Atom.make((get: AtomType.Context) => {
    const kept = get(placeKeptFrameAtom)
    return Option.map(
      Result.value(get(placeRenderFrameAtom)),
      (latest): PlaceFeatureHome =>
        draws(latest, name) && (settled(latest) || Option.exists(kept, (found) => draws(found, name)))
          ? "stage"
          : "proposal"
    )
  })
)

/**
 * How one disc is drawn. `settled`: a Motion node that travels from its name
 * and follows the search's moves. `arriving`: the search is making room for
 * a feature just merged; a ring marks the room until the search settles and
 * the name travels in. `trial`: placed outright, as the trace is scrubbed.
 */
export const PlaceDiscDrawn = Schema.Literal("settled", "arriving", "trial")

export type PlaceDiscDrawn = typeof PlaceDiscDrawn.Type

export const placeDiscDrawnAtom = Atom.family((name: string): AtomType.Atom<PlaceDiscDrawn> =>
  Atom.make((get: AtomType.Context) =>
    Match.value(get(placeDrawnAtom)).pipe(
      Match.when("trial", (): PlaceDiscDrawn => "trial"),
      Match.when("kept", (): PlaceDiscDrawn => "settled"),
      Match.when("sketch", () =>
        Option.match(get(placeFeatureHomeAtom(name)), {
          onNone: (): PlaceDiscDrawn => "settled",
          onSome: (home) =>
            Match.value(home).pipe(
              Match.when("stage", (): PlaceDiscDrawn => "settled"),
              Match.when("proposal", (): PlaceDiscDrawn => "arriving"),
              Match.exhaustive
            )
        })),
      Match.exhaustive
    )
  )
)

/** Why there is no frame: the search failed, or the document has no canvas to measure the place's text on. */
export type PlaceRenderError = DemoExecutionError | CanvasUnavailable

/**
 * The latest frame for the current artifact at the current stage width. A new
 * artifact or a new width starts a new search; the previous frame is kept
 * while it runs so the stage never blanks.
 */
export const placeRenderFrameAtom: AtomType.Atom<Result.Result<PlaceRenderFrame, PlaceRenderError>> = textLayoutRuntime
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
export const placeShownFrameAtom: AtomType.Atom<Result.Result<PlaceRenderFrame, PlaceRenderError>> = Atom.make(
  (get: AtomType.Context) => {
    const preview = get(placeTrialPreviewAtom)
    return Result.map(get(placeRenderFrameAtom), (found) => frameShowing(found, preview))
  }
)
