import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Duration, Effect, Equal, Layer, Match, Option, Schedule, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import * as HashSet from "effect/HashSet"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import {
  arrange,
  arrangedAround,
  Arrangement,
  description,
  descriptionInput,
  renderingFor
} from "../../contracts/demo/imagined-place-arrangement.js"
import {
  drawingBetween,
  paperExpected,
  paperUnder,
  PlaceDrawing,
  Stage,
  stageFor
} from "../../contracts/demo/imagined-place-flow.js"
import { type Meander, renderTrials } from "../../contracts/demo/imagined-place-search.js"
import { PlaceRendering } from "../../contracts/imagined-place-result.js"
import { type ParticipantRole, type PlaceArtifact, placeFeatures } from "../../contracts/imagined-place.js"
import { motionDuration } from "../../contracts/motion.js"
import { journeyFrom, toward, travellingOver } from "../motion/travel.js"
import type { CanvasUnavailable } from "../platform/BrowserDocument.js"
import { PlaceSearcher, workerGone } from "../services/PlaceSearcher.js"
import type { BrowserTextLayout } from "../text/browserTextLayout.js"
import { MarkerLabelWidths, markerLabelWidths } from "../view/home/placeMarkerLabels.js"
import { proposalAnchorLine } from "../view/home/placeViewModel.js"
import { prepareBrowserText } from "../view/text/authority.js"

import { placeArtifactAtom, placeBuildAtom, placeStageWidthAtom } from "./imagined-place.js"
import { type MotionPreference, motionPreferenceAtom } from "./motion.js"
import { textLayoutLayerAtom } from "./text-layout.js"

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
 * together and never overlap. The paper's edge is part of the drawing and
 * travels with it (`PlaceDrawing`). A frame is `complete` once the search is
 * over and the drawing has landed on its best.
 */
/**
 * Where the search stands. `running`: trials are still coming in, each a
 * jump the drawing follows. `landing`: every trial is in and the drawing is
 * travelling to the best. `complete`: the drawing has landed on it.
 */
export const PlaceSearchPhase = Schema.Literal("running", "landing", "complete")

export type PlaceSearchPhase = typeof PlaceSearchPhase.Type

export class PlaceSearch extends Schema.Class<PlaceSearch>("PlaceSearch")({
  phase: PlaceSearchPhase,
  stage: Stage,
  /** Every arrangement so far, in the order the search tried them. */
  tried: Schema.Array(Arrangement),
  /** Index into `tried` of the best so far: where the drawing is heading. */
  bestIndex: Schema.Int,
  /** The best so far, rendered: what the search has found, whether or not the drawing has reached it. */
  best: PlaceRendering,
  /** The description the lines set; a new artifact's lines replace the old ones rather than moving. */
  prose: Schema.String,
  /** The discs that carry their names at this stage width, and how wide each name wraps. */
  labels: MarkerLabelWidths,
  /**
   * The features the last settled arrangement drew, by name: what stands on
   * the stage until this search settles in turn. A drawn feature not among
   * them is one just merged, which the search is making room for. Before
   * anything has settled nothing has been merged, so this is every feature
   * the place came with.
   */
  settled: Schema.HashSetFromSelf(Schema.String)
}) {}

/**
 * What the stage draws at one frame: the search as it stands, and the
 * drawing where it has reached. The search changes once per trial; the
 * drawing, every frame while it travels. Readers of the search alone (the
 * trace, the caption, the code's live values) take it from `placeSearchAtom`,
 * which does not wake them for a frame: the same `PlaceSearch` is carried
 * through every frame of a trial's travel.
 */
export class PlaceRenderFrame extends Schema.Class<PlaceRenderFrame>("PlaceRenderFrame")({
  search: PlaceSearch,
  /** Index into the search's `tried` of the arrangement the drawing is of, or heading for: the best, or the trial chosen. */
  trial: Schema.Int,
  /** The drawing: the best arrangement once the discs have landed on it, the text flowed around them on the way. */
  rendering: PlaceRendering,
  /** The height of the paper under the drawing, where its edge has reached. */
  paper: Schema.Number
}) {}

/** The loss of every trial so far: the trace of the search. */
export const searchLosses = (search: PlaceSearch): ReadonlyArray<number> =>
  Arr.map(search.tried, (arrangement) => arrangement.quality.loss)

/** The same frame drawn with the trial at `index` instead; out of range leaves the frame as it is. */
export const frameShowing = (frame: PlaceRenderFrame, index: Option.Option<number>): PlaceRenderFrame =>
  Option.match(
    Option.flatMap(index, (trial) =>
      Option.map(Arr.get(frame.search.tried, trial), (arrangement) => ({ trial, arrangement }))),
    {
      onNone: () =>
        frame,
      onSome: ({ arrangement, trial }) =>
        new PlaceRenderFrame({
          ...frame,
          trial,
          rendering: renderingFor({
            arrangement,
            bestLoss: frame.search.best.evidence.bestLoss,
            stage: frame.search.stage,
            trials: frame.search.tried.length
          })
        })
    }
  )

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

/**
 * The search, one element per trial: its progress after that trial. The
 * study is open on the search worker for as long as the stream; the page
 * scores each meander the worker proposes (`candidate`) and tells it the
 * loss. The worker samples the next trial while the page waits out the frame
 * delay, so the sampler's growing cost is off the drawing thread and out of
 * the trial's time alike. A worker that is gone — failed or fallen silent —
 * is searched past once: the search starts over on the fresh worker the
 * searcher spawns, and the same seed finds the same place. Only a second
 * loss, or the search refusing what it was asked, is a failed drawing.
 */
const search = (
  candidate: (meander: Meander) => Arrangement
): Stream.Stream<Progress, DemoExecutionError, PlaceSearcher> =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const searcher = yield* PlaceSearcher
      const study = yield* searcher.open

      const trial = (current: Option.Option<Progress>) =>
        Effect.gen(function*() {
          const asked = yield* Option.match(current, {
            onNone: () => study.ask,
            onSome: () => Effect.zipRight(Effect.sleep(frameDelay), study.ask, { concurrent: true })
          })
          const arrangement = candidate(asked.meander)
          yield* study.tell(asked.trial, arrangement.quality.loss)
          return advance(current, arrangement)
        })

      return Stream.unfoldEffect(Option.none<Progress>(), (current) =>
        Option.exists(current, trialsDone)
          ? Effect.succeedNone
          : Effect.map(trial(current), (next) => Option.some([next, Option.some(next)])))
    })
  ).pipe(
    Stream.retry(Schedule.once.pipe(Schedule.whileInput(workerGone))),
    Stream.mapError((cause) => renderFailed(String(cause)))
  )

/** How long the drawing takes to reach a new best: the theme's `shift`, or none when the reader asked for less motion. */
const travelDuration = (motion: MotionPreference): Duration.Duration =>
  Match.value(motion).pipe(
    Match.when("full", () => motionDuration("shift")),
    Match.when("reduced", () => Duration.zero),
    Match.exhaustive
  )

/**
 * Where the last drawing left off, for the next search to carry on from: the
 * discs wherever they were, landed or on their way, and the paper's height —
 * `held` for the new search's trials when the paper is the same width, so a
 * jump the search makes moves nothing around the stage; not held when the
 * width changed, since the old height means nothing at the new width — the
 * features the last settled arrangement drew, and the description its lines
 * were set from.
 */
class DrawingLeft extends Schema.Class<DrawingLeft>("DrawingLeft")({
  drawing: PlaceDrawing,
  held: Schema.Option(Schema.Number),
  settled: Schema.HashSetFromSelf(Schema.String),
  prose: Schema.String
}) {}

const drawnNames = (rendering: PlaceRendering): HashSet.HashSet<string> =>
  HashSet.fromIterable(Arr.map(rendering.projection.markers, (marker) => marker.name))

/** What a frame leaves for the next search: its own drawing if it settled, else what it was itself left. */
const settledAfter = (frame: PlaceRenderFrame): HashSet.HashSet<string> =>
  settled(frame) ? drawnNames(frame.rendering) : frame.search.settled

const renderStream = (
  artifact: PlaceArtifact,
  stageWidth: number,
  left: Option.Option<DrawingLeft>,
  motion: MotionPreference
): Stream.Stream<PlaceRenderFrame, DemoExecutionError, BrowserTextLayout | PlaceSearcher> =>
  Stream.unwrap(
    Effect.gen(function*() {
      const stage = stageFor(stageWidth)
      const prose = description(artifact)
      const prepared = yield* prepareBrowserText(descriptionInput(artifact))
      const labels = yield* markerLabelWidths(artifact, stage)
      const candidate = arrange(artifact, prepared, stage)
      const around = arrangedAround(prepared, stage)
      const travelling = travellingOver(drawingBetween(stage), travelDuration(motion))
      // A changed description's lines leave before anything else moves: the
      // drawing rests through their exit, so lines flowed around where the
      // discs were never stand over discs that have moved on.
      const rest = Option.match(left, {
        onNone: () => Duration.zero,
        onSome: (found) => found.prose === prose ? Duration.zero : motionDuration("exit")
      })
      const journey = yield* journeyFrom(Option.map(left, (found) => found.drawing), rest)
      // The paper while trials run: the last drawing's, or — for a first
      // drawing at this width — the paper the search is expected to want,
      // which is also what the stage showed before this frame.
      const held = Option.getOrElse(
        Option.flatMap(left, (found) => found.held),
        () => paperExpected(stage, prepared, placeFeatures(artifact))
      )
      const settledBefore = Option.match(left, {
        onNone: () => HashSet.fromIterable(Arr.map(placeFeatures(artifact), (feature) => feature.name)),
        onSome: (found) => found.settled
      })

      // The drawing's travel after a trial: toward the best so far, on the
      // held paper while trials are still coming in, on paper cut to the best
      // once they are all in — so the paper lands with the discs. One search
      // per trial, one rendering of the best per trial; every frame of the
      // travel shares them.
      const travelAfter = (progress: Progress): Stream.Stream<PlaceRenderFrame> => {
        const best = bestOf(progress)
        const done = trialsDone(progress)
        const rendered = (arrangement: Arrangement) =>
          renderingFor({ arrangement, bestLoss: best.quality.loss, stage, trials: progress.tried.length })
        const bestRendering = rendered(best)
        const fits = bestRendering.projection.stageHeight
        const heading = new PlaceDrawing({
          markers: best.markers,
          paper: done ? fits : held
        })
        const searchWhile = (landed: boolean) =>
          new PlaceSearch({
            phase: phaseOf(done, landed),
            stage,
            tried: progress.tried,
            bestIndex: progress.bestIndex,
            best: bestRendering,
            prose,
            labels,
            settled: settledBefore
          })
        const landed = new PlaceRenderFrame({
          search: searchWhile(true),
          trial: progress.bestIndex,
          rendering: bestRendering,
          paper: heading.paper
        })
        const onTheWay = searchWhile(false)
        const arrived = new PlaceRenderFrame({ ...landed, search: onTheWay })
        const paperOnTheWay = (drawn: PlaceDrawing): number =>
          done ? Math.max(drawn.paper, paperUnder(stage, drawn.markers)) : drawn.paper
        // The drawing arrives, and lands a frame later: whatever stands at the
        // arrival — the ring a disc will fill — is drawn exactly there before
        // anything is swapped for it, whether it travelled or was placed outright.
        return Stream.flatMap(toward(travelling, journey, heading), (drawn) =>
          Equal.equals(drawn, heading)
            ? Stream.concat(Stream.make(arrived), Stream.as(Stream.take(travelling.ticks, 1), landed))
            : Stream.make(
              new PlaceRenderFrame({
                search: onTheWay,
                trial: progress.bestIndex,
                rendering: rendered(around(drawn.markers)),
                paper: paperOnTheWay(drawn)
              })
            ))
      }

      return search(candidate).pipe(
        Stream.flatMap(travelAfter, { switch: true }),
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
 * The paper the stage draws on. Its width is the one the visitor chose and
 * applies at once. Its height is the drawing's own (`PlaceRenderFrame.paper`):
 * held at the settled arrangement's while the next search's trials run and
 * while trials are scrubbed, so nothing around the stage moves for a jump the
 * search makes; travelling with the discs once the trials are in, so a disc
 * heading past the old edge is never cut and the paper lands with the discs.
 * Before the first drawing it is the paper the search is expected to want
 * (`placeExpectedPaperAtom`), which the first drawing then holds: the stage
 * is cut to size from the moment the artifact is known, and the first frame
 * moves nothing around it.
 */
export const PlaceSheet = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number
})

export type PlaceSheet = typeof PlaceSheet.Type

export const placeSheetAtom: AtomType.Atom<Option.Option<PlaceSheet>> = Atom.make((get: AtomType.Context) =>
  Option.match(Result.value(get(placeRenderFrameAtom)), {
    onSome: (latest) => Option.some(PlaceSheet.make({ width: latest.search.stage.stageWidth, height: latest.paper })),
    onNone: () =>
      Option.map(
        Result.value(get(placeExpectedPaperAtom)),
        (expected) => PlaceSheet.make({ width: get(placeStageWidthAtom), height: expected })
      )
  })
)

/**
 * Where a feature is at home: on the `stage` while it is drawn as a settled
 * disc, in its `proposal` while it is not. A merged feature stays at home in
 * its proposal while the search makes room for it — a ring on the stage —
 * and is on the stage once the search settles, where the disc fills the
 * ring; so the disc appears where the feature stays, never at a first random
 * trial. A declined feature leaves the drawing the moment the next search
 * starts. Derived from the frame alone: `PlaceSearch.settled` is what the
 * last settled arrangement drew.
 */
export const PlaceFeatureHome = Schema.Literal("stage", "proposal")

export type PlaceFeatureHome = typeof PlaceFeatureHome.Type

export const placeFeatureHomeAtom = Atom.family((name: string): AtomType.Atom<Option.Option<PlaceFeatureHome>> =>
  Atom.make((get: AtomType.Context) =>
    Option.map(
      Result.value(get(placeRenderFrameAtom)),
      (latest): PlaceFeatureHome =>
        draws(latest, name) && (settled(latest) || HashSet.has(latest.search.settled, name)) ? "stage" : "proposal"
    )
  )
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
 * What drawing the place needs: the page's text measurement — the same layer
 * `textLayoutRuntime` runs, so the two share one measurement cache — and the
 * search worker.
 */
const placeRenderRuntime: AtomType.AtomRuntime<BrowserTextLayout | PlaceSearcher, CanvasUnavailable> = Atom.runtime(
  (get: AtomType.Context) => Layer.merge(get(textLayoutLayerAtom), PlaceSearcher.Default)
)

/**
 * The latest frame for the current artifact at the current stage width. A new
 * artifact or a new width starts a new search; the previous frame is kept
 * while it runs so the stage never blanks. Until the first artifact arrives
 * the drawing is waiting, not failed: a stream that ended here without a
 * frame would be reported as a failure, so it waits instead.
 */
export const placeRenderFrameAtom: AtomType.Atom<Result.Result<PlaceRenderFrame, PlaceRenderError>> = placeRenderRuntime
  .atom((get: AtomType.Context) => {
    const artifact = get(placeArtifactAtom)
    const stageWidth = get(placeStageWidthAtom)
    const motion = get(motionPreferenceAtom)
    // The drawing carries on from wherever the last one left off, landed or on its way.
    const left = Option.map(
      Option.flatMap(get.self<Result.Result<PlaceRenderFrame, PlaceRenderError>>(), Result.value),
      (previous) =>
        new DrawingLeft({
          drawing: new PlaceDrawing({ markers: previous.rendering.projection.markers, paper: previous.paper }),
          held: previous.search.stage.stageWidth === stageWidth ? Option.some(previous.paper) : Option.none(),
          settled: settledAfter(previous),
          prose: previous.search.prose
        })
    )
    // A new search means new trials; a trial chosen from the old one no longer exists.
    get.set(placeTrialPreviewAtom, Option.none())
    return Option.match(artifact, {
      onNone: () => Stream.never,
      onSome: (value) => renderStream(value, stageWidth, left, motion)
    })
  })

/**
 * The paper the search is expected to want for the current artifact at the
 * current stage width (`paperExpected`), from the same prepared text the
 * drawing flows: what the stage is cut to before the first frame, and what
 * that frame holds. Waiting, like the frame, until the artifact arrives.
 */
export const placeExpectedPaperAtom: AtomType.Atom<Result.Result<number, PlaceRenderError>> = placeRenderRuntime.atom(
  (get: AtomType.Context) => {
    const stage = stageFor(get(placeStageWidthAtom))
    return Option.match(get(placeArtifactAtom), {
      onNone: () => Effect.never,
      onSome: (artifact) =>
        prepareBrowserText(descriptionInput(artifact)).pipe(
          Effect.map((prepared) => paperExpected(stage, prepared, placeFeatures(artifact))),
          Effect.mapError((cause) => renderFailed(String(cause)))
        )
    })
  }
)

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
