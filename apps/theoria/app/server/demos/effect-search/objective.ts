/**
 * effect-search-dependent orchestration for the optimization demo.
 *
 * Pure math lives in contracts/demo/objective.ts — this file provides
 * only the Effect/effect-search wrappers needed by the server.
 *
 * @since 0.1.0
 * @module
 */
import { Data, Effect, Match } from "effect"

import type { Sampler } from "effect-search"
import { SearchSpace, Study } from "effect-search"

import { type Config2D, defaultTrialBudget, objectiveAt, searchBounds } from "../../../contracts/demo/objective.js"

export const objective = (config: Config2D) => Effect.succeed(objectiveAt(config))

export const makeSearchSpace = SearchSpace.make({
  x: SearchSpace.float(searchBounds.xMin, searchBounds.xMax),
  y: SearchSpace.float(searchBounds.yMin, searchBounds.yMax)
})

class UnexpectedSearchResult extends Data.TaggedError("UnexpectedSearchResult")<{
  readonly kind: string
}> {}

export const minimizeWith = (sampler: Sampler.Sampler, trialBudget: number = defaultTrialBudget) =>
  Effect.gen(function*() {
    const space = yield* makeSearchSpace

    const result = yield* Study.minimize({
      space,
      sampler,
      objective,
      trials: trialBudget
    })

    return yield* Match.value(result).pipe(
      Match.tag("SingleObjective", (single) => Effect.succeed(single)),
      Match.orElse((value) => Effect.fail(new UnexpectedSearchResult({ kind: value._tag })))
    )
  })
