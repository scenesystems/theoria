import type { Page } from "@playwright/test"
import { Effect, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Rec from "effect/Record"
import * as Str from "effect/String"

import { act, type BrowserError } from "./browser.js"
import { recordedFootprints } from "./platform/in-page.js"

/**
 * The footprints `recordFootprints` records — each region of the
 * demonstration's painted height, from its first frame — read back and
 * grouped, so a test can say that what stands in for the demonstration while
 * it loads, or while it has failed, stands at the height of what it stands in
 * for. A shift the layout-shift observer would forgive is still a change of
 * shape, so the footprint is what is asserted, not the score.
 */

/** One footprint report: a region's name, its painted height, and the drawing's phase at the time. */
export const Footprint = Schema.Struct({
  region: Schema.String,
  height: Schema.NumberFromString,
  phase: Schema.String
})
export type Footprint = typeof Footprint.Type

const footprint = (line: string) => {
  const [region = "", height = "0", phase = "-"] = line.split(" ")
  return Schema.decodeUnknownSync(Footprint)({ region, height, phase })
}

/** Every footprint recorded so far, in the order painted. */
export const footprintsSoFar = (page: Page): Effect.Effect<ReadonlyArray<Footprint>, BrowserError> =>
  Effect.map(
    act(() => page.evaluate(recordedFootprints)),
    (recorded) => Arr.map(Arr.filter(recorded.split("\n"), Str.isNonEmpty), footprint)
  )

const landing = (report: Footprint): boolean => report.phase === "landing" || report.phase === "complete"

/** The footprints painted before the drawing first lands, by region, in the order painted. */
export const untilLanding = (reports: ReadonlyArray<Footprint>): Record<string, ReadonlyArray<Footprint>> =>
  Arr.groupBy(Arr.takeWhile(reports, (report) => !landing(report)), (report) => report.region)

/** Every footprint recorded until the drawing lands, by region, in the order painted. */
export const footprintsUntilLanding = (
  page: Page
): Effect.Effect<Record<string, ReadonlyArray<Footprint>>, BrowserError> =>
  Effect.map(footprintsSoFar(page), untilLanding)

/**
 * Each region's height at rest, as the last footprint painted left it: the
 * height a region stands at once nothing more is reported for it.
 */
export const restingHeights = (reports: ReadonlyArray<Footprint>): Record<string, number> =>
  Rec.map(Arr.groupBy(reports, (report) => report.region), (painted) => Arr.lastNonEmpty(painted).height)

/**
 * The footprints painted up to the start of the second search — the first
 * `running` after a landing — and those painted from it on. A region's rest
 * before the second search is its rest after the first landing.
 */
export const aroundSecondSearch = (
  reports: ReadonlyArray<Footprint>
): { readonly first: ReadonlyArray<Footprint>; readonly second: ReadonlyArray<Footprint> } => {
  const secondStart = Arr.findFirstIndex(
    reports,
    (report, index) => report.phase === "running" && Arr.some(Arr.take(reports, index), landing)
  )
  return Option.match(secondStart, {
    onNone: () => ({ first: reports, second: [] }),
    onSome: (index) => ({ first: Arr.take(reports, index), second: Arr.drop(reports, index) })
  })
}

/** The distinct heights each region was painted at, by region: one each where nothing shifted. */
export const heightsByRegion = (
  footprints: Record<string, ReadonlyArray<Footprint>>
): Record<string, ReadonlyArray<number>> =>
  Rec.map(footprints, (reports) => Arr.dedupe(Arr.map(reports, (report) => report.height)))
