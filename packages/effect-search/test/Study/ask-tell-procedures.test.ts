import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import { isStudyHandle } from "../../src/Study/api/askTell.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1)
  })

describe("Study handle guard", () => {
  it.effect("accepts an opened study handle and rejects a tag-only impostor", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 555 }),
          direction: "minimize",
          trials: 1,
          objective: () => Effect.succeed(0)
        })

        expect(isStudyHandle(handle)).toBe(true)
        expect(isStudyHandle({ _tag: "effect-search/StudyHandle" })).toBe(false)
      })
    ))
})
