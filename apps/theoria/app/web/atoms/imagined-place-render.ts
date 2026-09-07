import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Study } from "@scenesystems/effect-search"
import { Data, Duration, Effect, Equal, Match, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import {
  arrange,
  arrangedAround,
  Arrangement,
  description,
  descriptionInput,
  meanderSpace,
  renderingFor,
  renderSampler,
  renderTrials
} from "../../contracts/demo/imagined-place-arrangement.js"
import type { Meander } from "../../contracts/demo/imagined-place-flow.js"
import { markersBetween, type Stage, stageFor } from "../../contracts/demo/imagined-place-flow.js"
import type { PlaceMarker, PlaceRendering } from "../../contracts/imagined-place-result.js"
import type { ParticipantRole, PlaceArtifact } from "../../contracts/imagined-place.js"
import { motionDuration } from "../../contracts/motion.js"
import { journeyFrom, toward, travellingOver } from "../motion/travel.js"
import type { CanvasUnavailable } from "../platform/BrowserDocument.js"
import type { BrowserTextLayout } from "../text/browserTextLayout.js"
import { type MarkerLabelWidths, markerLabelWidths } from "../view/home/placeMarkerLabels.js"
import { proposalAnchorLine } from "../view/home/placeViewModel.js"
import { prepareBrowserText } from "../view/text/authority.js"

import { placeArtifactAtom, placeBuildAtom, placeStageWidthAtom } from "./imagined-place.js"
import { type MotionPreference, motionPreferenceAtom } from "./motion.js"
import { textLayoutRuntime } from "./text-layout.js"

/**
 * Draws the place in the browser with the browser's own font metrics.
 *
 * This is the same search the server runs in `server/imagined-place/render.ts`
 * (same seed, same trial budget, same objective), driven step by step with
 * `Study.ask`/`Study.tell` so the page can show the arrangement improving.
 *
 * The search moves in jumps: each better trial is a new arrangement, and a
 * merge or a decline is a new artifact whose arrangements place every disc
 * anew. The drawing does not jump with any of it: the discs travel from where
 * they are to where the new best puts them over the theme's `shift`, keeping
 * the geometry's own rules on the way (`markersBetween`), and every frame the
 * text is flowed around the discs as drawn — so the discs and the text move
 * together and never overlap. A frame is `complete` once the search is over
 * and the drawing has landed on its best.
 */
/**
 * Where the search stands. `running`: trials are still coming in, each a
 * jump the drawing follows. `landing`: every trial is in and the drawing is
 * travelling to the best. `complete`: the drawing has landed on it.
 */
export const PlaceSearchPhase = Schema.Literal("running", "landing", "complete")

export type PlaceSearchPhase = typeof PlaceSearchPhase.Type

export class PlaceSearch extends Data.Class<{
  readonly phase: PlaceSearchPhase
  readonly stage: Stage
  /** Every arrangement so far, in the order the search tried them. */
  readonly tried: ReadonlyArray<Arrangement>
  /** Index into `tried` of the best so far: where the drawing is heading. */
  readonly bestIndex: number
  /** The best so far, rendered: what the search has found, whether or not the drawing has reached it. */
  readonly best: PlaceRendering
  /** The description the lines set; a new artifact's lines replace the old ones rather than moving. */
  readonly prose: string
  /** The discs that carry their names at this stage width, and how wide each name wraps. */
  readonly labels: MarkerLabelWidths
}> {}

/**
 * What the stage draws at one frame: the search as it stands, and the
 * drawing where it has reached. The search changes once per trial; the
 * drawing, every frame while it travels. Readers of the search alone (the
 * trace, the caption, the code's live values) take it from `placeSearchAtom`,
 * which does not wake them for a frame: the same `PlaceSearch` is carried
 * through every frame of a trial's travel.
 */
export class PlaceRenderFrame extends Data.Class<{
  readonly search: PlaceSearch
  /** The drawing: the best arrangement once the discs have landed on it, the text flowed around them on the way. */
  readonly rendering: PlaceRendering
}> {}

/** The loss of every trial so far: the trace of the search. */
export const searchLosses = (search: PlaceSearch): ReadonlyArray<number> =>
  Arr.map(search.tried, (arrangement) => arrangement.quality.loss)

/** The same frame drawn with the trial at `index` instead; out of range leaves the frame as it is. */
export const frameShowing = (frame: PlaceRenderFrame, index: Option.Option<number>): PlaceRenderFrame =>
  Option.match(Option.flatMap(index, (value) => Arr.get(frame.search.tried, value)), {
    onNone: () => frame,
    onSome: (arrangement) =>
      new PlaceRenderFrame({
        ...frame,
        rendering: renderingFor({
          arrangement,
          bestLoss: frame.search.best.evidence.bestLoss,
          stage: frame.search.stage,
          trials: frame.search.tried.length
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

const trialsDone = (progress: Progress): boolean => progress.tried.length >= renderTrials

const phaseOf = (done: boolean, landed: boolean): PlaceSearchPhase =>
  done ? (landed ? "complete" : "landing") : "running"

const advance = (current: Option.Option<Progress>, arrangement: Arrangement): Progress =>
  Option.match(current, {
    onNone: () => ({ tried: Arr.of(arrangement), bestIndex: 0 }),
    onSome: (progress) => ({
      tried: Arr.append(progress.tried, arrangement),
      bestIndex: arrangement.quality.loss < bestOf(progress).quality.loss ? progress.tried.length : progress.bestIndex
    })
  })

const renderFailed = (message: string) => new DemoExecutionError({ code: "execution-failed", message, retryable: true })

/** The search, one element per trial: its progress after that trial. The study lives as long as the stream. */
const search = (candidate: (meander: Meander) => Arrangement): Stream.Stream<Progress, DemoExecutionError> =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const space = yield* meanderSpace
      const handle = yield* Study.open({
        space,
        sampler: renderSampler(),
        objective: (meander) => Effect.succeed(candidate(meander).quality.loss),
        trials: renderTrials,
        direction: "minimize"
      })

      const trial = (current: Option.Option<Progress>) =>
        Effect.gen(function*() {
          yield* Option.match(current, { onNone: () => Effect.void, onSome: () => Effect.sleep(frameDelay) })
          const asked = yield* Study.ask(handle)
          const arrangement = candidate(asked.config)
          yield* Study.tell(handle, asked.trialNumber, arrangement.quality.loss)
          return advance(current, arrangement)
        })

      return Stream.unfoldEffect(Option.none<Progress>(), (current) =>
        Option.exists(current, trialsDone)
          ? Effect.succeedNone
          : Effect.map(trial(current), (next) => Option.some([next, Option.some(next)])))
    })
  ).pipe(Stream.mapError((cause) => renderFailed(String(cause))))

/** How long the drawing takes to reach a new best: the theme's `shift`, or none when the reader asked for less motion. */
const travelDuration = (motion: MotionPreference): Duration.Duration =>
  Match.value(motion).pipe(
    Match.when("full", () => motionDuration("shift")),
    Match.when("reduced", () => Duration.zero),
    Match.exhaustive
  )

const renderStream = (
  artifact: PlaceArtifact,
  stageWidth: number,
  from: Option.Option<ReadonlyArray<PlaceMarker>>,
  motion: MotionPreference
): Stream.Stream<PlaceRenderFrame, DemoExecutionError, BrowserTextLayout> =>
  Stream.unwrap(
    Effect.gen(function*() {
      const stage = stageFor(stageWidth)
      const prose = description(artifact)
      const prepared = yield* prepareBrowserText(descriptionInput(artifact))
      const labels = yield* markerLabelWidths(artifact, stage)
      const candidate = arrange(artifact, prepared, stage)
      const around = arrangedAround(prepared, stage)
      const travelling = travellingOver(markersBetween(stage), travelDuration(motion))
      const journey = yield* journeyFrom(from)

      // One search per trial, one rendering of the best per trial; every frame of the travel shares them.
      const framesAfter = (progress: Progress): (drawn: ReadonlyArray<PlaceMarker>) => PlaceRenderFrame => {
        const best = bestOf(progress)
        const rendered = (arrangement: Arrangement) =>
          renderingFor({ arrangement, bestLoss: best.quality.loss, stage, trials: progress.tried.length })
        const bestRendering = rendered(best)
        const searchWhile = (landed: boolean) =>
          new PlaceSearch({
            phase: phaseOf(trialsDone(progress), landed),
            stage,
            tried: progress.tried,
            bestIndex: progress.bestIndex,
            best: bestRendering,
            prose,
            labels
          })
        const landed = new PlaceRenderFrame({ search: searchWhile(true), rendering: bestRendering })
        const onTheWay = searchWhile(false)
        return (drawn) =>
          Equal.equals(drawn, best.markers)
            ? landed
            : new PlaceRenderFrame({ search: onTheWay, rendering: rendered(around(drawn)) })
      }

      return search(candidate).pipe(
        Stream.flatMap(
          (progress) => Stream.map(toward(travelling, journey, bestOf(progress).markers), framesAfter(progress)),
          { switch: true }
        ),
        Stream.takeUntil(settled)
      )
    }).pipe(Effect.mapError((cause) => renderFailed(String(cause))))
  )

/**
 * The trial the visitor chose to look at from the search trace, if any. The
 * stage draws it in place of the best, so a rejected arrangement can be seen
 * as the search saw it.
 */
export const placeTrialPreviewAtom: AtomType.Writable<Option.Option<number>> = Atom.make(Option.none<number>())

const settled = (frame: PlaceRenderFrame): boolean => frame.search.phase === "complete"

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
 * applies at once. Its height is `held` at the settled arrangement's while
 * the next search's trials run and while trials are scrubbed, so nothing
 * around the stage moves for a jump the search makes; once the trials are in
 * and the drawing travels to the best, the edge is `following` the drawing
 * frame by frame, so a disc heading past the old edge is never cut and the
 * paper lands with the discs. Until a search has settled at this width, it
 * follows the sketch.
 */
export const PlaceSheetEdge = Schema.Literal("held", "following")

export type PlaceSheetEdge = typeof PlaceSheetEdge.Type

export const PlaceSheet = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
  edge: PlaceSheetEdge
})

export type PlaceSheet = typeof PlaceSheet.Type

const holds = (frame: PlaceRenderFrame): boolean => frame.search.phase === "running"

export const placeSheetAtom: AtomType.Atom<Option.Option<PlaceSheet>> = Atom.make((get: AtomType.Context) => {
  const kept = get(placeKeptFrameAtom)
  return Option.map(Result.value(get(placeRenderFrameAtom)), (latest): PlaceSheet => {
    const width = latest.search.stage.stageWidth
    const heldHere = Option.filter(kept, (found) => found.search.stage.stageWidth === width && holds(latest))
    return Option.match(heldHere, {
      onNone: () =>
        PlaceSheet.make({
          width,
          height: stageHeight(latest),
          edge: latest.search.phase === "landing" ? "following" : "held"
        }),
      onSome: (found) => PlaceSheet.make({ width, height: stageHeight(found), edge: "held" })
    })
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
    const motion = get(motionPreferenceAtom)
    // The discs carry on from wherever the last drawing left them, landed or on their way.
    const from = Option.map(
      Option.flatMap(get.self<Result.Result<PlaceRenderFrame, PlaceRenderError>>(), Result.value),
      (previous) => previous.rendering.projection.markers
    )
    // A new search means new trials; a trial chosen from the old one no longer exists.
    get.set(placeTrialPreviewAtom, Option.none())
    return Option.match(artifact, {
      onNone: () => Stream.empty,
      onSome: (value) => renderStream(value, stageWidth, from, motion)
    })
  })

/** The frame the stage draws: the best arrangement, or the trial the visitor chose. */
export const placeShownFrameAtom: AtomType.Atom<Result.Result<PlaceRenderFrame, PlaceRenderError>> = Atom.make(
  (get: AtomType.Context) => {
    const preview = get(placeTrialPreviewAtom)
    return Result.map(get(placeRenderFrameAtom), (found) => frameShowing(found, preview))
  }
)

/**
 * The search as it stands, without the drawing. A `PlaceSearch` is equal to
 * the last one until a trial comes in or the drawing lands, so what reads
 * this is not re-rendered for every frame of the drawing's travel.
 */
export const placeSearchAtom: AtomType.Atom<Result.Result<PlaceSearch, PlaceRenderError>> = Atom.make(
  (get: AtomType.Context) => Result.map(get(placeRenderFrameAtom), (frame) => frame.search)
)

/**
 * The line of the drawn prose a merged proposal's sentence stands on, if it
 * is merged and drawn. Follows the drawing, which reflows the prose as the
 * discs travel, and changes only when the sentence moves to another line.
 */
export const placeProposalLineAtom = Atom.family((proposer: ParticipantRole): AtomType.Atom<Option.Option<number>> =>
  Atom.make((get: AtomType.Context) =>
    Option.flatMap(
      Option.all({ build: Result.value(get(placeBuildAtom)), frame: Result.value(get(placeRenderFrameAtom)) }),
      ({ build, frame }) =>
        Option.flatMap(
          Arr.findFirst(build.proposals, (record) => record.proposal.proposer === proposer),
          (record) => proposalAnchorLine(frame.rendering.projection, record)
        )
    )
  )
)
