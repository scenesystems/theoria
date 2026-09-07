import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import {
  type CodeSite,
  decodeMark,
  encodeMark,
  PlaceAct,
  type PlaceMark,
  type PlaceProvenance
} from "../../contracts/demo/imagined-place-provenance.js"
import type { ProposalRecord } from "../../contracts/imagined-place-result.js"
import type { PlaceScenario } from "../../contracts/imagined-place.js"
import { nextFrame } from "../platform/AnimationFrame.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserWindow from "../platform/BrowserWindow.js"
import { featuresAnswered, type PlaceOnPage, provenanceFor } from "../view/home/placeProvenance.js"
import { proposalAnchorLine } from "../view/home/placeViewModel.js"

import { placeShownFrameAtom } from "./imagined-place-render.js"
import { placeBuildAtom, placeControlsAtom } from "./imagined-place.js"
import { pageRouteAtom } from "./navigation.js"
import { appRuntime } from "./runtime.js"

/**
 * The demonstration as one experience: what the visitor is pointing at, which
 * act of the story they are reading, and which world the place is set in.
 * Each is one fact; everything the page does with it is derived.
 */

// ---------------------------------------------------------------------------
// Focus — the mark under the pointer
// ---------------------------------------------------------------------------

/**
 * The mark the visitor is pointing at, while the overlay answering it is open.
 * Written by the overlay from the trigger that opened it; read by the code
 * panel, which lights the line that made the mark.
 */
export const placeFocusAtom: AtomType.Writable<Option.Option<PlaceMark>> = Atom.make(Option.none<PlaceMark>())

/**
 * What is on the page to answer from: the build once it has arrived, and
 * the frame the stage is drawing this instant, so every answer agrees with
 * what is visible.
 */
export const placeOnPageAtom: AtomType.Atom<PlaceOnPage> = Atom.make((get: AtomType.Context) => ({
  build: Result.value(get(placeBuildAtom)),
  shown: Result.value(get(placeShownFrameAtom))
}))

/** The page's answer for the mark under the pointer, if it has one yet. */
export const placeFocusedProvenanceAtom: AtomType.Atom<Option.Option<PlaceProvenance>> = Atom.make(
  (get: AtomType.Context) => Option.flatMap(get(placeFocusAtom), (mark) => provenanceFor(mark, get(placeOnPageAtom)))
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
    Option.exists(
      Option.all({ provenance: get(placeFocusedProvenanceAtom), build: Result.value(get(placeBuildAtom)) }),
      ({ build, provenance }) => Arr.contains(featuresAnswered(provenance, build), name)
    )
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
      Match.tag("Feature", ({ name }) =>
        Option.flatMap(
          Option.all({ build: Result.value(get(placeBuildAtom)), shown: Result.value(get(placeShownFrameAtom)) }),
          ({ build, shown }) =>
            Option.flatMap(
              Arr.findFirst(build.proposals, (record: ProposalRecord) => record.proposal.feature.name === name),
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
        Match.tag("Feature", ({ name }) => get(placeFeatureFocusedAtom(name))),
        Match.tag("Line", ({ index }) => Option.contains(get(placeFocusedLineAtom), index)),
        Match.tag("CodeLine", ({ match, step }) =>
          Option.exists(get(placeFocusedSiteAtom), (site) => site.step === step && site.match === match)),
        Match.tag("Signature", "Digest", "Trial", "Inference", "Note", () =>
          Option.exists(get(placeAnsweredMarkAtom), (answered) =>
            encodeMark(answered) === encoded)),
        Match.exhaustive
      ))
  )
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
 * The act being read, from where the page stands in the viewport now: the
 * last landmark in the column that has reached the reading line, the
 * arrival if none has. Measured afresh after the first paint and on every
 * scroll, resize and fragment change — a projection of the position, so a
 * jump to a fragment, a resize that moves a landmark across the line, or
 * the page mounted again all answer rightly, with no crossing to have seen.
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

const actsRead: Stream.Stream<PlaceAct, never, BrowserDocument.BrowserDocument | BrowserWindow.BrowserWindow> = Stream
  .concat(Stream.fromEffect(nextFrame), BrowserWindow.viewportChanges)
  .pipe(Stream.mapEffect(() => actRead), Stream.changes)

const placeActInViewAtom: AtomType.Atom<Result.Result<PlaceAct>> = appRuntime.atom(actsRead)

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
 * viewport, wholly — from where the page stands now, measured afresh after
 * the first paint and on every scroll, resize and fragment change. The band
 * moves nothing in the page's flow, so the column stands where it would
 * without the band, and the measure is one and the same either way.
 */
const stageReadPast: Effect.Effect<boolean, never, BrowserDocument.BrowserDocument> = Effect.map(
  BrowserDocument.querySelectorAll(stageColumnSelector),
  (columns) => Option.exists(Arr.head(columns), (column) => column.getBoundingClientRect().bottom <= 0)
)

const stageReadPastNow: Stream.Stream<boolean, never, BrowserDocument.BrowserDocument | BrowserWindow.BrowserWindow> =
  Stream.concat(Stream.fromEffect(nextFrame), BrowserWindow.viewportChanges).pipe(
    Stream.mapEffect(() => stageReadPast),
    Stream.changes
  )

const placeStageReadPastAtom: AtomType.Atom<Result.Result<boolean>> = appRuntime.atom(stageReadPastNow)

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

// ---------------------------------------------------------------------------
// World — the scenario the place is set in
// ---------------------------------------------------------------------------

/** The world the visitor chose: the page's air changes with it the moment they do. */
export const placeWorldAtom: AtomType.Atom<PlaceScenario> = Atom.make(
  (get: AtomType.Context) => get(placeControlsAtom).scenario
)

/**
 * Keeps `data-world` on `<html>` in step with the world while the home page
 * is the page, and off it anywhere else, so the docs keep the plain canvas;
 * mount once at the app root.
 */
export const placeWorldApplicationAtom: AtomType.Atom<Result.Result<void>> = appRuntime.atom((get) =>
  Match.value(get(pageRouteAtom)).pipe(
    Match.tag("HomeRoute", () => BrowserDocument.setRootData("world", get(placeWorldAtom))),
    Match.tag(
      "DocsIndexRoute",
      "DocsOverviewRoute",
      "DocsGuideRoute",
      "DocsApiRoute",
      "DocsNotFoundRoute",
      () => BrowserDocument.removeRootData("world")
    ),
    Match.exhaustive
  )
)
