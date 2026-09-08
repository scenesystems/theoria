import type { Page } from "@playwright/test"
import { Effect, Schema } from "effect"
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

/** Every footprint recorded until the drawing lands, by region, in the order painted. */
export const footprintsUntilLanding = (
  page: Page
): Effect.Effect<Record<string, ReadonlyArray<Footprint>>, BrowserError> =>
  Effect.map(
    act(() => page.evaluate(recordedFootprints)),
    (recorded) =>
      Arr.groupBy(
        Arr.takeWhile(
          Arr.map(Arr.filter(recorded.split("\n"), Str.isNonEmpty), footprint),
          (report) => report.phase !== "landing" && report.phase !== "complete"
        ),
        (report) => report.region
      )
  )

/** The distinct heights each region was painted at, by region: one each where nothing shifted. */
export const heightsByRegion = (
  footprints: Record<string, ReadonlyArray<Footprint>>
): Record<string, ReadonlyArray<number>> =>
  Rec.map(footprints, (reports) => Arr.dedupe(Arr.map(reports, (report) => report.height)))
