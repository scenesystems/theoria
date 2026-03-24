import { describe, expect, it } from "@effect/vitest"
import { Effect, Record } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import { askTellProcedureCatalog, isStudyHandle } from "../../src/Study/api/askTell.js"
import { askTellProcedureCatalog as decomposedCatalog } from "../../src/Study/api/askTell/catalog.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1)
  })

describe("Study ask-tell procedure catalog", () => {
  it.effect("exposes dedicated ask/tell procedure catalog and stable StudyHandle boundary", () =>
    Effect.scoped(
      Effect.gen(function*() {
        expect(Record.keys(askTellProcedureCatalog).sort()).toEqual([
          "ask",
          "cancel",
          "events",
          "fail",
          "open",
          "result",
          "snapshot",
          "tell"
        ])

        expect(askTellProcedureCatalog).toBe(decomposedCatalog)

        const handle = yield* Study.open({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 555 }),
          direction: "minimize",
          trials: 1,
          objective: () => Effect.succeed(0)
        })

        expect(isStudyHandle(handle)).toBe(true)
        expect(Reflect.get(handle, "runtime")).toBeUndefined()
        expect(Reflect.get(handle, "stateActor")).toBeUndefined()
        expect(Reflect.get(handle, "optimizePlan")).toBeUndefined()

        expect(isStudyHandle({ _tag: "effect-search/StudyHandle" })).toBe(false)
      })
    ))
})
