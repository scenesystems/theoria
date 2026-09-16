import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { placeLiveValues } from "../../app/web/view/home/placeLiveValues.js"
import { sourceUrl } from "../../app/web/view/home/placeReferences.js"
import { placeSteps } from "../../app/web/view/home/placeSteps.js"

describe("How it's built references", () => {
  it.effect("pins source links to the build commit and falls back to HEAD for a local server", () =>
    Effect.sync(() => {
      expect(sourceUrl("0123456789abcdef", "apps/theoria/app/server/imagined-place/run.ts")).toBe(
        "https://github.com/scenesystems/theoria/blob/0123456789abcdef/apps/theoria/app/server/imagined-place/run.ts"
      )
      expect(sourceUrl("dev-local", "x.ts")).toBe("https://github.com/scenesystems/theoria/blob/HEAD/x.ts")
    }))

  it.effect("shows no values before anything has been built", () =>
    Effect.sync(() => {
      Arr.forEach(placeSteps, (step) => {
        expect(placeLiveValues(step, Option.none(), Option.none(), Option.none())).toEqual([])
      })
    }))
})
