/**
 * effect-search-dependent orchestration for the optimization study surface.
 *
 * Pure math lives in contracts/capability/effect-search.ts — this file provides
 * only the Effect/effect-search wrappers needed by the server.
 *
 * @since 0.1.0
 * @module
 */
import { Data, Effect, Match } from "effect"

import type { Sampler } from "effect-search"
import { SearchSpace, Study } from "effect-search"

import { Config2D, SearchBounds, SearchConfig } from "../../../contracts/capability/effect-search.js"

const bounds = SearchBounds.defaults()

export const objective = (config: Config2D) => Effect.succeed(Config2D.objectiveValue(config))

export const searchSpace = SearchSpace.make({
  x: SearchSpace.float(bounds.xMin, bounds.xMax),
  y: SearchSpace.float(bounds.yMin, bounds.yMax)
})

class UnexpectedSearchResult extends Data.TaggedError("UnexpectedSearchResult")<{
  readonly kind: string
}> {}

export const minimizeWith = (
  sampler: Sampler.Sampler,
  trialBudget: number = SearchConfig.defaults().trialBudget
) =>
  Effect.gen(function*() {
    const space = yield* searchSpace

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
