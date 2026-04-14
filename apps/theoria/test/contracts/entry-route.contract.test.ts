import { describe, expect, it } from "@effect/vitest"
import { Option } from "effect"

import {
  entryApiRouteFromPathname,
  EntryPreloadRoute,
  EntryRunRoute,
  EntryStreamRoute
} from "../../app/contracts/entry/api-route.js"

describe("entry api route authority", () => {
  it("round-trips the run, preload, and stream transport nouns through canonical paths", () => {
    const runRoute = EntryRunRoute.fromEntryId("workflow")
    const preloadRoute = EntryPreloadRoute.fromEntryId("workflow")
    const streamRoute = EntryStreamRoute.fromEntryId("workflow")

    expect(runRoute.path()).toBe("/api/entries/workflow/run")
    expect(preloadRoute.path()).toBe("/api/entries/workflow/preload")
    expect(streamRoute.path()).toBe("/api/entries/workflow/stream")
    expect(streamRoute.url("{\"request\":\"workflow\"}")).toBe(
      "/api/entries/workflow/stream?request=%7B%22request%22%3A%22workflow%22%7D"
    )

    expect(entryApiRouteFromPathname(runRoute.path())).toEqual(Option.some(runRoute))
    expect(entryApiRouteFromPathname(preloadRoute.path())).toEqual(Option.some(preloadRoute))
    expect(entryApiRouteFromPathname(streamRoute.path())).toEqual(Option.some(streamRoute))
    expect(entryApiRouteFromPathname("/api/entries/not-real/run")).toEqual(Option.none())
  })
})
