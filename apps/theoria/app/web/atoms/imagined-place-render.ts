import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Duration, Effect, Equal, Layer, Match, Option, Schedule, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as Record from "effect/Record"

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
  drawingScaled,
  paperExpected,
  paperUnder,
  PlaceDrawing,
  Stage,
  stageFor
} from "../../contracts/demo/imagined-place-flow.js"
import type { DrawingId } from "../../contracts/demo/imagined-place-provenance.js"
import { placeSourceId } from "../../contracts/demo/imagined-place-provenance.js"
import { type Meander, renderTrials } from "../../contracts/demo/imagined-place-search.js"
import { PlaceRendering } from "../../contracts/imagined-place-result.js"
import { PlaceBuild } from "../../contracts/imagined-place-result.js"
import { placeFeatures } from "../../contracts/imagined-place.js"
import { motionDuration, motionExitBound } from "../../contracts/motion.js"
import { journeyFrom, releaseRest, toward, travellingOver } from "../motion/travel.js"
import type { CanvasUnavailable } from "../platform/BrowserDocument.js"
import { PlaceSearcher, workerGone } from "../services/PlaceSearcher.js"
import type { BrowserTextLayout } from "../text/browserTextLayout.js"
import { MarkerLabelWidths, markerLabelWidths } from "../view/home/placeMarkerLabels.js"
import { legendFromMarkers, legendFromOutline, type PlaceLegendEntry } from "../view/home/placeViewModel.js"
import { prepareBrowserText } from "../view/text/authority.js"

import { placeBuildAtom, placeBuiltAtom, placeOutlineAtom, placeStageMeasuredWidthAtom } from "./imagined-place.js"
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
  source: PlaceBuild,
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

/** The drawing a search is of: its source at its stage width. */
export const drawingId = (search: PlaceSearch): DrawingId => ({
  source: placeSourceId(search.source),
  stageWidth: search.stage.stageWidth
})

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
export const travelDuration = (motion: MotionPreference): Duration.Duration =>
  Match.value(motion).pipe(
    Match.when("full", () => motionDuration("shift")),
    Match.when("reduced", () => Duration.zero),
    Match.exhaustive
  )

/**
 * The description whose lines stand on the stage: reported by the stage as
 * its set of lines mounts and unmounts, so the drawing can rest until the
 * lines set from a new description are up — which, with the old set leaving
 * before the new one mounts, is when the old lines have left. None while no
 * set stands: before the first, and in the moment between one set and the next.
 */
export const placeLinesOnStageAtom: AtomType.Writable<Option.Option<string>> = Atom.make(Option.none<string>())

/**
 * The longest the drawing rests before it travels: a changed description's
 * lines leave before anything else moves, so lines flowed around where the
 * discs were never stand over discs that have moved on. The rest ends when the
 * new lines stand (`placeLinesOnStageAtom`); this is only the bound on that
 * signal. Under reduced motion the stage swaps the prose in the same frame it
 * places the drawing, so there is nothing to rest for — and resting would
 * leave the new lines, flowed around where the discs will be, over discs that
 * have not moved yet.
 */
export const restBeforeTravel = (
  left: Option.Option<string>,
  prose: string,
  motion: MotionPreference
): Duration.Duration =>
  Match.value(motion).pipe(
    Match.when("full", () =>
      Option.match(left, {
        onNone: () => Duration.zero,
        onSome: (before) => before === prose ? Duration.zero : motionExitBound
      })),
    Match.when("reduced", () => Duration.zero),
    Match.exhaustive
  )

/** Once the lines set from `prose` stand on the stage, as `linesOnStage` reports them. */
const linesStanding = (linesOnStage: Stream.Stream<Option.Option<string>>, prose: string): Effect.Effect<void> =>
  Stream.runDrain(Stream.take(Stream.filter(linesOnStage, Option.contains(prose)), 1))

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
  source: PlaceBuild,
  stageWidth: number,
  left: Option.Option<DrawingLeft>,
  motion: MotionPreference,
  linesOnStage: Stream.Stream<Option.Option<string>>
): Stream.Stream<PlaceRenderFrame, DemoExecutionError, BrowserTextLayout | PlaceSearcher> =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const artifact = source.artifact
      const stage = stageFor(stageWidth)
      const prose = description(artifact)
      const prepared = yield* prepareBrowserText(descriptionInput(artifact))
      const labels = yield* markerLabelWidths(artifact, stage)
      const candidate = arrange(artifact, prepared, stage)
      const around = arrangedAround(prepared, stage)
      const travelling = travellingOver(drawingBetween(stage), travelDuration(motion))
      const rest = restBeforeTravel(Option.map(left, (found) => found.prose), prose, motion)
      const journey = yield* journeyFrom(Option.map(left, (found) => found.drawing), rest)
      // A rest owed is for the old lines to leave: it ends when the new lines
      // stand, or at its bound. The wait lives as long as this drawing does.
      yield* Effect.unless(
        Effect.forkScoped(Effect.andThen(linesStanding(linesOnStage, prose), releaseRest(journey))),
        () => Duration.isZero(rest)
      )
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
            source,
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
 * The paper the stage draws on. Its width is the drawing's, cut to the column
 * the stage has now: never wider than the column, so a column made narrower
 * shows the drawing fitted to it — scaled as one piece by `fit`, its height
 * with it — until the arrangement for the new width lands; a column made wider
 * leaves the drawing its size, centred, since nothing is scaled up. Its height
 * is otherwise the drawing's own (`PlaceRenderFrame.paper`): held at the
 * settled arrangement's while the next search's trials run and while trials
 * are scrubbed, so nothing around the stage moves for a jump the search makes;
 * travelling with the discs once the trials are in, so a disc heading past
 * the old edge is never cut and the paper lands with the discs. Before the
 * first drawing it is the paper the search is expected to want
 * (`placeExpectedPaperAtom`), which the first drawing then holds: the stage
 * is cut to size from the moment the artifact is known, and the first frame
 * moves nothing around it.
 */
export const PlaceSheet = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
  /** The scale the drawing on the sheet is shown at: 1 while the column holds it, less while it is fitted to a narrower one. */
  fit: Schema.Number
})

export type PlaceSheet = typeof PlaceSheet.Type

/** How far a drawing `drawn` wide is scaled to stand on a column `measured` wide: whole while the column holds it, never up. */
export const sheetFit = (measured: number, drawn: number): number => Math.min(1, measured / drawn)

/** The sheet under a drawing `drawn` wide with `paper` under it, on a column `measured` wide. */
export const sheetFitting = (measured: number, drawn: number, paper: number): PlaceSheet => {
  const fit = sheetFit(measured, drawn)
  return PlaceSheet.make({ width: Math.min(measured, drawn), height: paper * fit, fit })
}

export const placeSheetAtom: AtomType.Atom<Option.Option<PlaceSheet>> = Atom.make((get: AtomType.Context) =>
  Option.match(Result.value(get(placeRenderFrameAtom)), {
    onSome: (latest) => {
      const drawn = latest.search.stage.stageWidth
      return Option.some(
        sheetFitting(Option.getOrElse(get(placeStageMeasuredWidthAtom), () => drawn), drawn, latest.paper)
      )
    },
    onNone: () =>
      Option.map(
        Option.all([get(placeStageMeasuredWidthAtom), Result.value(get(placeExpectedPaperAtom))]),
        ([width, expected]) => PlaceSheet.make({ width, height: expected, fit: 1 })
      )
  })
)

/**
 * Where a feature is at home: on the `stage` while it is drawn as a settled
 * disc, in its `proposal` while it is not. A merged feature stays at home in
 * its proposal while the search makes room for it — a ring on the stage —
 * and is on the stage once the search settles, where the disc fills the
 * ring; so the disc appears where the feature stays, never at a first random
 * trial. Derived from the frame alone: `PlaceSearch.settled` is what the
 * last settled arrangement drew.
 */
export const PlaceFeatureHome = Schema.Literal("stage", "proposal")

export type PlaceFeatureHome = typeof PlaceFeatureHome.Type

export const featureHome = (frame: PlaceRenderFrame, name: string): PlaceFeatureHome =>
  draws(frame, name) && (settled(frame) || HashSet.has(frame.search.settled, name)) ? "stage" : "proposal"

/** Whether the search is heading for a feature: the best so far places every feature the place has; a drawn marker of any other name is on its way out. */
const heading = (frame: PlaceRenderFrame, name: string): boolean =>
  Arr.some(frame.search.best.projection.markers, (marker) => marker.name === name)

/**
 * How one disc is drawn. `settled`: the disc, positioned by the frame and
 * filled in place; it follows the search's moves frame by frame. `arriving`:
 * the search is making room for a feature just merged; a ring marks the room
 * until the search settles and the disc fills it where it stands. `leaving`:
 * the feature is declined, or gone with the story, and its disc shrinks away
 * where it stood as the drawing travels — no longer a mark, its name gone
 * with the feature. `trial`: placed outright, as the trace is scrubbed.
 */
export const PlaceDiscDrawn = Schema.Literal("settled", "arriving", "leaving", "trial")

export type PlaceDiscDrawn = typeof PlaceDiscDrawn.Type

/**
 * How the disc named is drawn in `frame` — the frame the stage shows, or none
 * before the first — the stage showing `drawn`. A pure reading of the frame
 * the stage draws, so the discs of one frame are all told from that frame: a
 * disc read from an atom of its own could be told from a later frame than
 * the one it stands in — and a disc leaving the drawing, held by Motion
 * while it goes, would be redrawn by every frame after it and never let go.
 */
export const discDrawn = (drawn: PlaceDrawn, frame: Option.Option<PlaceRenderFrame>, name: string): PlaceDiscDrawn =>
  Match.value(drawn).pipe(
    Match.when("trial", (): PlaceDiscDrawn => "trial"),
    Match.when("kept", (): PlaceDiscDrawn => "settled"),
    Match.when("sketch", () =>
      Option.match(frame, {
        onNone: (): PlaceDiscDrawn => "settled",
        onSome: (shown): PlaceDiscDrawn =>
          heading(shown, name)
            ? Match.value(featureHome(shown, name)).pipe(
              Match.when("stage", (): PlaceDiscDrawn => "settled"),
              Match.when("proposal", (): PlaceDiscDrawn => "arriving"),
              Match.exhaustive
            )
            : "leaving"
      })),
    Match.exhaustive
  )

/** How the disc named is drawn in the frame the stage shows now, for what stands apart from the stage — the band. */
export const placeDiscDrawnAtom = Atom.family((name: string): AtomType.Atom<PlaceDiscDrawn> =>
  Atom.make((get: AtomType.Context) => discDrawn(get(placeDrawnAtom), Result.value(get(placeShownFrameAtom)), name))
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
 * and the column has been measured, the drawing is waiting, not failed: a
 * stream that ended here without a frame would be reported as a failure, so
 * it waits instead.
 */
export const placeRenderFrameAtom: AtomType.Atom<Result.Result<PlaceRenderFrame, PlaceRenderError>> = placeRenderRuntime
  .atom((get: AtomType.Context) => {
    const build = get(placeBuiltAtom)
    const stageWidth = get(placeStageMeasuredWidthAtom)
    const motion = get(motionPreferenceAtom)
    // The drawing carries on from wherever the last one left off, landed or on its way — as it is shown: fitted to the column when the column is narrower than it was drawn for.
    const left = Option.map(
      Option.flatMap(get.self<Result.Result<PlaceRenderFrame, PlaceRenderError>>(), Result.value),
      (previous) =>
        new DrawingLeft({
          drawing: drawingScaled(
            new PlaceDrawing({ markers: previous.rendering.projection.markers, paper: previous.paper }),
            Option.match(stageWidth, {
              onNone: () => 1,
              onSome: (measured) => sheetFit(measured, previous.search.stage.stageWidth)
            })
          ),
          held: Option.contains(stageWidth, previous.search.stage.stageWidth)
            ? Option.some(previous.paper)
            : Option.none(),
          settled: settledAfter(previous),
          prose: previous.search.prose
        })
    )
    // A new search means new trials; a trial chosen from the old one no longer exists.
    get.set(placeTrialPreviewAtom, Option.none())
    return Option.match(Option.all([build, stageWidth]), {
      onNone: () => Stream.never,
      onSome: ([value, width]) => renderStream(value, width, left, motion, get.stream(placeLinesOnStageAtom))
    })
  })

/**
 * The paper the search is expected to want for the place's outline at the
 * current stage width (`paperExpected`), from the same prepared text the
 * drawing flows: what the stage is cut to before the first frame, and what
 * that frame holds. Before the build arrives the outline is the scenario's
 * recording under the chosen acceptances — the same text every build of that
 * story describes — so the stage holds its size while the server replays the
 * program; the build's artifact is the outline once it is here.
 */
export const placeExpectedPaperAtom: AtomType.Atom<Result.Result<number, PlaceRenderError>> = placeRenderRuntime.atom(
  (get: AtomType.Context) =>
    Option.match(get(placeStageMeasuredWidthAtom), {
      onNone: () => Effect.never,
      onSome: (stageWidth) => {
        const stage = stageFor(stageWidth)
        const outline = get(placeOutlineAtom)
        return prepareBrowserText(descriptionInput(outline)).pipe(
          Effect.map((prepared) => paperExpected(stage, prepared, placeFeatures(outline))),
          Effect.mapError((cause) => renderFailed(String(cause)))
        )
      }
    })
)

/**
 * Which discs are expected to carry their names at the current stage width,
 * measured from the outline with the same engine the drawing uses
 * (`markerLabelWidths`): empty when the discs will be numbered. Decided before
 * the first frame, so the legend that accompanies numbered discs is laid
 * before the drawing and the drawing changes nothing under it.
 */
export const placeExpectedLabelsAtom: AtomType.Atom<Result.Result<MarkerLabelWidths, PlaceRenderError>> =
  placeRenderRuntime.atom((get: AtomType.Context) =>
    Option.match(get(placeStageMeasuredWidthAtom), {
      onNone: () => Effect.never,
      onSome: (stageWidth) =>
        markerLabelWidths(get(placeOutlineAtom), stageFor(stageWidth)).pipe(
          Effect.mapError((cause) => renderFailed(String(cause)))
        )
    })
  )

/** The frame the stage draws: the best arrangement, or the trial the visitor chose. */
export const placeShownFrameAtom: AtomType.Atom<Result.Result<PlaceRenderFrame, PlaceRenderError>> = Atom.make(
  (get: AtomType.Context) => {
    const preview = get(placeTrialPreviewAtom)
    return Result.map(get(placeRenderFrameAtom), (found) => frameShowing(found, preview))
  }
)

/**
 * The legend the stage shows under numbered discs: none while the discs carry
 * their names. From the shown frame's markers once there is a drawing — the
 * features the search is heading for, not a disc shrinking away, whose name
 * has left with its feature — before it, from the outline whenever the names
 * are expected not to fit — the same names in the same order as the drawing
 * will number them, so the legend is on the page at its full height from the
 * first frame and holds its lines through a travel.
 */
export const placeLegendAtom: AtomType.Atom<Option.Option<ReadonlyArray<PlaceLegendEntry>>> = Atom.make(
  (get: AtomType.Context) =>
    Option.match(Result.value(get(placeShownFrameAtom)), {
      onSome: (frame) =>
        Record.isEmptyRecord(frame.search.labels)
          ? Option.some(
            legendFromMarkers(
              Arr.filter(frame.rendering.projection.markers, (marker) => heading(frame, marker.name))
            )
          )
          : Option.none(),
      onNone: () =>
        Option.flatMap(Result.value(get(placeExpectedLabelsAtom)), (labels) =>
          Record.isEmptyRecord(labels)
            ? Option.some(legendFromOutline(get(placeOutlineAtom)))
            : Option.none())
    })
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
 * What has failed the stage: the build the place is made from, or the drawing
 * of it — and whether the run asked for in its place is under way. The build
 * failing is the reason there is no drawing, so it is the failure whatever
 * the drawing says. One failure at a time, told in one place — the search
 * caption's row, there in every state at one height — so nothing around the
 * stage moves for it.
 */
export class StageFailure extends Schema.Class<StageFailure>("StageFailure")({
  failed: Schema.Literal("build", "draw"),
  waiting: Schema.Boolean
}) {}

export const stageFailure = (
  build: Result.Result<unknown, unknown>,
  frame: Result.Result<unknown, unknown>
): Option.Option<StageFailure> =>
  Result.isFailure(build)
    ? Option.some(new StageFailure({ failed: "build", waiting: build.waiting }))
    : Result.isFailure(frame)
    ? Option.some(new StageFailure({ failed: "draw", waiting: frame.waiting }))
    : Option.none()

export const placeFailureAtom: AtomType.Atom<Option.Option<StageFailure>> = Atom.make((get: AtomType.Context) =>
  stageFailure(get(placeBuildAtom), get(placeRenderFrameAtom))
)

/**
 * What the paper stands as where there is no drawing: waiting for one, or
 * told that none is coming until it is asked for. A failure with its run
 * under way is waiting again.
 */
export const PlaceWait = Schema.Literal("pending", "failed")
export type PlaceWait = typeof PlaceWait.Type

export const placeWait = (failure: Option.Option<StageFailure>): PlaceWait =>
  Option.exists(failure, (found) => !found.waiting) ? "failed" : "pending"

export const placeWaitAtom: AtomType.Atom<PlaceWait> = Atom.make((get: AtomType.Context) =>
  placeWait(get(placeFailureAtom))
)
