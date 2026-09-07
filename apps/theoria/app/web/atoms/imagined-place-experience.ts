import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import {
  type AnswerFocusReturn,
  type CodeSite,
  codeSite,
  type CodeSiteId,
  decodeMark,
  encodeMark,
  focusReturnAfter,
  type HoverIntent,
  type MarkPress,
  PlaceAct,
  PlaceAnswer,
  type PlaceMark,
  PlaceProvenance,
  type PointerOver,
  type PressOutcome
} from "../../contracts/demo/imagined-place-provenance.js"
import type { ProposalRecord } from "../../contracts/imagined-place-result.js"
import { answerCloseGrace, answerOpenDelay } from "../../contracts/motion.js"
import { nextFrame } from "../platform/AnimationFrame.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserWindow from "../platform/BrowserWindow.js"
import * as ElementSize from "../platform/ElementSize.js"
import { howItsBuiltSectionId } from "../view/home/HomeHero.js"
import { type PlaceOnPage, provenanceFor } from "../view/home/placeProvenance.js"
import { proposalAnchorLine } from "../view/home/placeViewModel.js"

import { placeShownFrameAtom } from "./imagined-place-render.js"
import { placeBuildAtom, placeStepAtom } from "./imagined-place.js"
import { motionPreferenceAtom, scrollBehaviorFor } from "./motion.js"
import { navigateToElementAtom } from "./navigation.js"
import { appRuntime } from "./runtime.js"

/**
 * The demonstration as one experience: what the visitor is pointing at and
 * which act of the story they are reading.
 * Each is one fact; everything the page does with it is derived.
 */

// ---------------------------------------------------------------------------
// Focus — the open answer and owned hover intent
// ---------------------------------------------------------------------------

const answerState = Atom.make(Option.none<PlaceAnswer>())
const answerFocusReturnState = Atom.make<AnswerFocusReturn>("mark")
const answerLeavingState = Atom.make(Option.none<PlaceProvenance>())

/**
 * The open answer: the mark the visitor is pointing at, and how it was opened.
 * Written by the overlay; read by the code panel, which lights the line that
 * made the mark. Writing it also records how it was opened, because the popup
 * decides where focus goes as it closes — after the answer itself is gone. A
 * hover answer never had focus; a pressed one hands it back. Closing it keeps
 * what was being said, for the popup to leave with.
 */
export const placeAnswerAtom: AtomType.Writable<Option.Option<PlaceAnswer>> = Atom.writable(
  (get: AtomType.Context) => Option.filter(get(answerState), () => Option.isSome(get(placeFocusedProvenanceAtom))),
  (ctx: AtomType.WriteContext<Option.Option<PlaceAnswer>>, value: Option.Option<PlaceAnswer>) => {
    Option.match(value, {
      onNone: () => ctx.set(answerLeavingState, ctx.get(placeAnswerOnShowAtom)),
      onSome: (answer) => ctx.set(answerFocusReturnState, focusReturnAfter(answer.opening))
    })
    ctx.set(answerState, value)
  }
)

/**
 * Where focus goes when the answer on show — or the one just leaving —
 * closes. Decided when the answer opens, and kept while it closes, so the
 * closing popover can still ask.
 */
export const placeAnswerFocusReturnAtom: AtomType.Atom<AnswerFocusReturn> = answerFocusReturnState

/** The mark whose answer is open; all existing focus projections derive from this authority. */
export const placeFocusAtom: AtomType.Atom<Option.Option<PlaceMark>> = Atom.map(
  placeAnswerAtom,
  Option.map((answer: PlaceAnswer) => answer.mark)
)

/** The pointer's current provenance interaction region. Touch uses Base UI press instead. */
export const placePointerOverAtom: AtomType.Writable<Option.Option<PointerOver>> = Atom.make(
  Option.none<PointerOver>()
)

/**
 * Turn pointer entries into delayed latest-wins decisions. The delay begins
 * at entry (there is deliberately no movement-based hover-rest heuristic).
 */
export const hoverIntents = (
  pointerOver: Stream.Stream<Option.Option<PointerOver>>
): Stream.Stream<HoverIntent> =>
  pointerOver.pipe(
    Stream.flatMap(
      (over) =>
        Match.value(over).pipe(
          Match.tag(
            "None",
            () => Stream.fromEffect(Effect.sleep(answerCloseGrace).pipe(Effect.as<HoverIntent>({ _tag: "Close" })))
          ),
          Match.tag("Some", ({ value }) =>
            Match.value(value).pipe(
              Match.tag("Mark", ({ mark, triggerId }) =>
                Stream.fromEffect(
                  Effect.sleep(answerOpenDelay(mark)).pipe(
                    Effect.as<HoverIntent>({ _tag: "Open", triggerId, mark })
                  )
                )),
              Match.tag("Answer", () => Stream.empty),
              Match.exhaustive
            )),
          Match.exhaustive
        ),
      { switch: true }
    )
  )

/**
 * What an intent does to the open answer: opening answers the mark as a
 * hover; closing closes a hover answer and leaves a pressed one pinned.
 */
export const answerAfterIntent = (
  current: Option.Option<PlaceAnswer>,
  intent: HoverIntent
): Option.Option<PlaceAnswer> =>
  Match.value(intent).pipe(
    Match.tag("Open", ({ mark, triggerId }) => Option.some(new PlaceAnswer({ triggerId, mark, opening: "hover" }))),
    Match.tag("Close", () => Option.filter(current, (answer) => answer.opening === "press")),
    Match.exhaustive
  )

const sameMark = (left: PlaceMark, right: PlaceMark): boolean => encodeMark(left) === encodeMark(right)

/**
 * Pressing a digest copies it; while its answer is open the press changes
 * nothing about the answer, so it stays as it was opened, says "Copied", and
 * leaves as it would have. Pressing the mark of a hover answer pins that
 * answer rather than closing it. Any other press is what the popover says:
 * opening answers the pressed mark, pinned; closing closes.
 */
export const answerAfterPress = (current: Option.Option<PlaceAnswer>, press: MarkPress): PressOutcome =>
  Option.match(
    Option.filter(current, (answer) => sameMark(answer.mark, press.pressed.mark)),
    {
      onNone: () => ({
        _tag: "Answer",
        answer: press.opening
          ? Option.some(new PlaceAnswer({ ...press.pressed, opening: "press" }))
          : Option.none()
      }),
      onSome: (answer): PressOutcome =>
        press.pressed.mark._tag === "Digest"
          ? { _tag: "Leave" }
          : answer.opening === "hover"
          ? { _tag: "Pin", answer: new PlaceAnswer({ ...answer, opening: "press" }) }
          : { _tag: "Answer", answer: Option.none() }
    }
  )

/** The one process that writes provenance answers from pointer intent. */
export const placeHoverIntentAtom = appRuntime.atom((get: AtomType.Context) =>
  hoverIntents(get.stream(placePointerOverAtom)).pipe(
    Stream.runForEach((intent) =>
      Effect.sync(() => {
        get.set(placeAnswerAtom, answerAfterIntent(get.once(placeAnswerAtom), intent))
      })
    )
  )
)

/**
 * What is on the page to answer from: the build once it has arrived, and
 * the frame the stage is drawing this instant, so every answer agrees with
 * what is visible.
 */
export const placeOnPageAtom: AtomType.Atom<PlaceOnPage> = Atom.make((get: AtomType.Context) => ({
  build: Result.value(get(placeBuildAtom)),
  shown: Result.value(get(placeShownFrameAtom))
}))

/**
 * The page's answer for the open answer's mark, if it has one: read from the
 * build and the drawing shown this instant, so it is what the popover says
 * and what the code panel and the discs light.
 */
export const placeFocusedProvenanceAtom: AtomType.Atom<Option.Option<PlaceProvenance>> = Atom.make(
  (get: AtomType.Context) =>
    Option.flatMap(get(answerState), (answer) => provenanceFor(answer.mark, get(placeOnPageAtom)))
)

/**
 * What the popup says: the answer on show, or, while it closes, the one just
 * leaving. A popup fades out over a moment; it fades with its last words
 * rather than emptying the instant the answer is let go.
 */
export const placeAnswerOnShowAtom: AtomType.Atom<Option.Option<PlaceProvenance>> = Atom.make(
  (get: AtomType.Context) => Option.orElse(get(placeFocusedProvenanceAtom), () => get(answerLeavingState))
)

/** The answer open, and what the page says about it this instant. */
const Answering = Schema.Struct({ answer: Schema.Option(PlaceAnswer), provenance: Schema.Option(PlaceProvenance) })
type Answering = typeof Answering.Type
const answeringAtom: AtomType.Atom<Answering> = Atom.make((get: AtomType.Context) =>
  Answering.make({ answer: get(answerState), provenance: get(placeFocusedProvenanceAtom) })
)

/** An answer is open for a mark the page can no longer answer: its drawing was replaced, or its build. */
const vanished = (answering: Answering): boolean =>
  Option.isSome(answering.answer) && Option.isNone(answering.provenance)

/**
 * An answer lives as long as the page can answer it. When what it was
 * pointed at leaves the page — the drawing it was on is replaced by the
 * next story's, a feature is no longer in the build — the answer is let go
 * with what it last said, and focus stays where it is, since the mark that
 * opened it is gone too. The overlay mounts this for as long as answers can
 * be open.
 */
export const placeAnswerLifetimeAtom = appRuntime.atom((get: AtomType.Context) =>
  get.stream(answeringAtom).pipe(
    Stream.zipWithPrevious,
    Stream.filter(([, current]) => vanished(current)),
    Stream.runForEach(([previous]) =>
      Effect.sync(() => {
        get.set(answerLeavingState, Option.flatMap(previous, (was) => was.provenance))
        get.set(answerFocusReturnState, "stays")
        get.set(answerState, Option.none())
      })
    )
  )
)

/** The line of code that made what the visitor is pointing at. */
export const placeFocusedSiteAtom: AtomType.Atom<Option.Option<CodeSite>> = Atom.make((get: AtomType.Context) =>
  Option.map(get(placeFocusedProvenanceAtom), (provenance) => provenance.site)
)

/** The mark answered: the one pointed at, or for a line of code, the mark of what that line made. */
export const placeAnsweredMarkAtom: AtomType.Atom<Option.Option<PlaceMark>> = Atom.make((get: AtomType.Context) =>
  Option.map(get(placeFocusedProvenanceAtom), (provenance) => provenance.mark)
)

/**
 * Whether the feature named is among those answered — pointed at itself, or
 * one of the features the line of code pointed at composed — so its disc on
 * the stage can say so.
 */
export const placeFeatureFocusedAtom = Atom.family((name: string): AtomType.Atom<boolean> =>
  Atom.make((get: AtomType.Context) =>
    Option.exists(get(placeFocusedProvenanceAtom), (provenance) => Arr.contains(provenance.about, name))
  )
)

/**
 * The line of the drawn prose the answer stands on: the line pointed at, or
 * the line a merged proposal's sentence stands on when its feature is pointed
 * at — read from the drawing shown this instant, as the sentence moves while
 * the discs travel.
 */
export const placeFocusedLineAtom: AtomType.Atom<Option.Option<number>> = Atom.make((get: AtomType.Context) =>
  Option.flatMap(get(placeAnsweredMarkAtom), (mark) =>
    Match.value(mark).pipe(
      Match.tag("Line", ({ index }) => Option.some(index)),
      Match.tag("Feature", "Disc", ({ name }) =>
        Option.flatMap(
          Result.value(get(placeShownFrameAtom)),
          (shown) =>
            Option.flatMap(
              Arr.findFirst(
                shown.search.source.proposals,
                (record: ProposalRecord) => record.proposal.feature.name === name
              ),
              (record) => proposalAnchorLine(shown.rendering.projection, record)
            )
        )),
      Match.tag("Signature", "Digest", "Trial", "Inference", "Note", "CodeLine", () => Option.none()),
      Match.exhaustive
    ))
)

/**
 * Whether a mark on the page is answered by the open overlay, so it can say
 * so where it stands. A feature is answered when it is among the features
 * answered; a line, when it is the line the answer stands on; a line of
 * code, when the answer credits its site — the same rule that lights the
 * line in the code panel, so the code lights from the prose as the prose
 * does from the code; anything else, when it is the mark answered. Keyed by
 * the mark's attribute value, since a mark is a value and not a handle.
 */
export const placeMarkFocusedAtom = Atom.family((encoded: string): AtomType.Atom<boolean> =>
  Atom.make((get: AtomType.Context) =>
    Option.exists(decodeMark(encoded), (mark) =>
      Match.value(mark).pipe(
        Match.tag("Feature", "Disc", ({ name }) => get(placeFeatureFocusedAtom(name))),
        Match.tag("Line", ({ index }) => Option.contains(get(placeFocusedLineAtom), index)),
        Match.tag("CodeLine", ({ site }) => Option.exists(get(placeFocusedSiteAtom), (focused) => focused.id === site)),
        Match.tag("Signature", "Digest", "Trial", "Inference", "Note", () =>
          Option.exists(get(placeAnsweredMarkAtom), (answered) => encodeMark(answered) === encoded)),
        Match.exhaustive
      ))
  )
)

/** The attribute a gutter mark carries its site's id on, so the route from an answer can find it. */
export const placeCodeSiteAttribute = "data-place-code-site"

/**
 * From an answer to the line of code it credits: the line's step is selected,
 * the answer is let go where it is — focus does not return to its mark — and
 * the section becomes the history entry, settling on the line's gutter mark
 * once the step has rendered, as the reader's motion preference says.
 */
export const placeGoToSiteAtom = appRuntime.fn<CodeSiteId>()((id, ctx) =>
  Effect.sync(() => {
    const site = codeSite(id)
    ctx.set(placeStepAtom, site.step)
    ctx.set(answerFocusReturnState, "stays")
    ctx.set(placeAnswerAtom, Option.none())
    ctx.set(navigateToElementAtom, {
      href: `#${howItsBuiltSectionId}`,
      selector: `[${placeCodeSiteAttribute}="${id}"]`,
      behavior: scrollBehaviorFor(ctx(motionPreferenceAtom))
    })
  })
)

// ---------------------------------------------------------------------------
// Act — where the visitor is reading
// ---------------------------------------------------------------------------

/** Each landmark in the reading column carries its act here; the stage answers the one in view. */
export const placeActAttribute = "data-place-act"

const decodeAct = Schema.decodeUnknownOption(PlaceAct)

/** The reading line: halfway down the viewport. A landmark above it has been reached. */
const readingLine = 0.5

/**
 * Every time where the page stands in the viewport may have changed: the
 * first paint; each scroll, resize and fragment change; and each change of
 * the page's own height, which is the layout moving under a still viewport
 * — the build landing in the column, the paper growing under a search.
 * Anything measured against the viewport is measured again on each, so it
 * is a projection of the position and never a history of edges crossed.
 */
const pageStandingChanges: Stream.Stream<
  unknown,
  never,
  BrowserDocument.BrowserDocument | BrowserWindow.BrowserWindow
> = Stream.concat(
  Stream.fromEffect(nextFrame),
  Stream.merge(
    BrowserWindow.viewportChanges,
    Stream.unwrap(Effect.map(BrowserDocument.body, ElementSize.contentHeights))
  )
)

/**
 * The act being read, from where the page stands in the viewport now: the
 * last landmark in the column that has reached the reading line, the
 * arrival if none has. Measured afresh on every change of where the page
 * stands, so a jump to a fragment, a resize that moves a landmark across the
 * line, the paper growing above one, or the page mounted again all answer
 * rightly, with no crossing to have seen.
 */
const actRead: Effect.Effect<PlaceAct, never, BrowserDocument.BrowserDocument | BrowserWindow.BrowserWindow> = Effect
  .gen(function*() {
    const landmarks = yield* BrowserDocument.querySelectorAll(`[${placeActAttribute}]`)
    const line = (yield* BrowserWindow.viewportHeight) * readingLine
    const reached = Arr.filter(landmarks, (landmark) => landmark.getBoundingClientRect().top <= line)
    return Option.getOrElse(
      Option.flatMap(Arr.last(reached), (landmark) => decodeAct(landmark.getAttribute(placeActAttribute))),
      (): PlaceAct => "arrive"
    )
  })

/** The act being read, as it changes. */
export const placeActsRead: Stream.Stream<
  PlaceAct,
  never,
  BrowserDocument.BrowserDocument | BrowserWindow.BrowserWindow
> = pageStandingChanges.pipe(Stream.mapEffect(() => actRead), Stream.changes)

const placeActInViewAtom: AtomType.Atom<Result.Result<PlaceAct>> = appRuntime.atom(placeActsRead)

/** The act being read; the arrival until anything has been. */
export const placeActAtom: AtomType.Atom<PlaceAct> = Atom.make((get: AtomType.Context) =>
  Result.getOrElse(get(placeActInViewAtom), (): PlaceAct => "arrive")
)

/**
 * The proposals that were declined, shown as ghosts at the paper's margin
 * while the proposing act is being read: what the version does not contain,
 * and who offered it.
 */
export const placeGhostsAtom: AtomType.Atom<ReadonlyArray<ProposalRecord>> = Atom.make((get: AtomType.Context) =>
  Match.value(get(placeActAtom)).pipe(
    Match.when("propose", () =>
      Option.match(Result.value(get(placeBuildAtom)), {
        onNone: (): ReadonlyArray<ProposalRecord> => [],
        onSome: (build) => Arr.filter(build.proposals, (record) => !record.accepted)
      })),
    Match.whenOr("arrive", "compose", "record", "build", (): ReadonlyArray<ProposalRecord> => []),
    Match.exhaustive
  )
)

// ---------------------------------------------------------------------------
// Band — the place kept in view once the stage has been read past
// ---------------------------------------------------------------------------

/** The stage's column, whose leaving the viewport the band answers. */
const stageColumnSelector = `[data-place-stage="column"]`

/**
 * Whether the drawn place has been read past — the stage's column above the
 * viewport, wholly — from where the page stands now, measured afresh on
 * every change of where the page stands. The band moves nothing in the
 * page's flow, so the column stands where it would without the band, and
 * the measure is one and the same either way.
 */
const stageReadPast: Effect.Effect<boolean, never, BrowserDocument.BrowserDocument> = Effect.map(
  BrowserDocument.querySelectorAll(stageColumnSelector),
  (columns) => Option.exists(Arr.head(columns), (column) => column.getBoundingClientRect().bottom <= 0)
)

/** Whether the stage has been read past, as it changes. */
export const placeStageReadPastNow: Stream.Stream<
  boolean,
  never,
  BrowserDocument.BrowserDocument | BrowserWindow.BrowserWindow
> = pageStandingChanges.pipe(Stream.mapEffect(() => stageReadPast), Stream.changes)

const placeStageReadPastAtom: AtomType.Atom<Result.Result<boolean>> = appRuntime.atom(placeStageReadPastNow)

/**
 * Whether the band is shown: the place as a band, pinned to the top of the
 * viewport from the moment the stage is scrolled past until it is scrolled
 * back to, so the world is never off screen while the visitor reads how it
 * was made. Below the stage — on arrival, or the stage yet to be reached —
 * there is no band; past the demonstration the band leaves with it, being in
 * its flow.
 */
export const placeBandAtom: AtomType.Atom<boolean> = Atom.make((get: AtomType.Context) =>
  Result.getOrElse(get(placeStageReadPastAtom), () => false)
)
