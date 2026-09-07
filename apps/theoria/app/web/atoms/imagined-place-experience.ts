import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import {
  type CodeSite,
  PlaceAct,
  type PlaceMark,
  type PlaceProvenance
} from "../../contracts/demo/imagined-place-provenance.js"
import type { ProposalRecord } from "../../contracts/imagined-place-result.js"
import type { PlaceScenario } from "../../contracts/imagined-place.js"
import { nextFrame } from "../platform/AnimationFrame.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"
import type { BrowserWindow } from "../platform/BrowserWindow.js"
import * as ElementIntersection from "../platform/ElementIntersection.js"
import { featuresAnswered, provenanceFor } from "../view/home/placeProvenance.js"

import { placeSearchAtom } from "./imagined-place-render.js"
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

/** The page's answer for the mark under the pointer, if it has one yet. */
export const placeFocusedProvenanceAtom: AtomType.Atom<Option.Option<PlaceProvenance>> = Atom.make(
  (get: AtomType.Context) =>
    Option.flatMap(
      get(placeFocusAtom),
      (mark) => provenanceFor(mark, Result.value(get(placeBuildAtom)), Result.value(get(placeSearchAtom)))
    )
)

/** The line of code that made what the visitor is pointing at. */
export const placeFocusedSiteAtom: AtomType.Atom<Option.Option<CodeSite>> = Atom.make((get: AtomType.Context) =>
  Option.map(get(placeFocusedProvenanceAtom), (provenance) => provenance.site)
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

// ---------------------------------------------------------------------------
// Act — where the visitor is reading
// ---------------------------------------------------------------------------

/** Each landmark in the reading column carries its act here; the stage answers the one in view. */
export const placeActAttribute = "data-place-act"

const decodeAct = Schema.decodeUnknownOption(PlaceAct)

/**
 * The band of the viewport an act is read in: from two fifths of the way
 * down to the middle. A landmark crossing it is the act being read; between
 * landmarks the last one read holds.
 */
const readingBand: IntersectionObserverInit = { rootMargin: "-40% 0px -50% 0px", threshold: 0 }

/**
 * The act whose landmark is in the reading band, as the visitor scrolls.
 * The landmarks are looked up once the page has painted and observed from
 * then on; the stream reports only entries into the band, so the value
 * holds while the visitor is between acts.
 */
const actsInView: Stream.Stream<PlaceAct, never, BrowserDocument.BrowserDocument | BrowserWindow> = Stream.fromEffect(
  nextFrame
).pipe(
  Stream.flatMap(() => Stream.fromEffect(BrowserDocument.querySelectorAll(`[${placeActAttribute}]`))),
  Stream.flatMap((landmarks) => ElementIntersection.intersections(landmarks, readingBand)),
  Stream.filter((entry) => entry.isIntersecting),
  Stream.filterMap((entry) => decodeAct(entry.target.getAttribute(placeActAttribute)))
)

const placeActInViewAtom: AtomType.Atom<Result.Result<PlaceAct>> = appRuntime.atom(actsInView)

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
    Match.orElse((): ReadonlyArray<ProposalRecord> => [])
  )
)

// ---------------------------------------------------------------------------
// Band — the place kept in view once the stage has been read past
// ---------------------------------------------------------------------------

/** The stage's column, whose leaving the viewport the band answers. */
const stageColumnSelector = `[data-place-stage="column"]`

/** Whether the stage has been scrolled past: out of the viewport, above it. */
const scrolledPast = (entry: IntersectionObserverEntry): boolean =>
  !entry.isIntersecting && entry.boundingClientRect.bottom <= 0

/**
 * Whether the drawn place has been read past, as the visitor scrolls. The
 * column is looked up once the page has painted and observed from then on;
 * the observer reports each crossing of the viewport's edge. The band moves
 * nothing in the page's flow, so the column's place is the same with the
 * band and without, and the crossing is one edge, not two.
 */
const stageReadPast: Stream.Stream<boolean, never, BrowserDocument.BrowserDocument | BrowserWindow> = Stream
  .fromEffect(nextFrame)
  .pipe(
    Stream.flatMap(() => Stream.fromEffect(BrowserDocument.querySelectorAll(stageColumnSelector))),
    Stream.flatMap((columns) => ElementIntersection.intersections(columns, { threshold: 0 })),
    Stream.map(scrolledPast)
  )

const placeStageReadPastAtom: AtomType.Atom<Result.Result<boolean>> = appRuntime.atom(stageReadPast)

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
    Match.orElse(() => BrowserDocument.removeRootData("world"))
  )
)
