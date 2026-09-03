import { Effect, Match } from "effect"

import { Study } from "@scenesystems/effect-search"
import { Text } from "@scenesystems/effect-text"

import {
  arrange,
  descriptionInput,
  meanderSpace,
  renderingFor,
  renderSampler,
  renderTrials
} from "../../contracts/demo/imagined-place-arrangement.js"
import { stageFor } from "../../contracts/demo/imagined-place-flow.js"
import type { PlaceRendering } from "../../contracts/imagined-place-result.js"
import { type PlaceArtifact, PlaceBuildError } from "../../contracts/imagined-place.js"

/**
 * Renders the artifact for one stage width on the server, with effect-text's
 * default measurer. The browser runs the same search with real font metrics
 * (`web/atoms/imagined-place-render.ts`); this one serves tests and the CLI
 * walkthrough, and proves the arrangement code has no browser dependency.
 *
 * The description is prepared once, then a seeded TPE study moves the
 * features until the text flows well around them. The objective is computed
 * from real line breaks, not a proxy.
 */
export const render = (artifact: PlaceArtifact, stageWidth: number): Effect.Effect<PlaceRendering, PlaceBuildError> =>
  Effect.gen(function*() {
    const stage = stageFor(stageWidth)
    const prepared = yield* Text.prepareWithSegments(descriptionInput(artifact))
    const candidate = arrange(artifact, prepared, stage)

    const result = yield* Study.minimize({
      space: yield* meanderSpace,
      sampler: renderSampler(),
      objective: (meander) => Effect.succeed(candidate(meander).quality.loss),
      trials: renderTrials
    })
    const best = yield* Match.value(result).pipe(
      Match.tag("SingleObjective", (single) => Effect.succeed(single)),
      Match.orElse((other) =>
        Effect.fail(new PlaceBuildError({ stage: "render", message: `unexpected study result ${other._tag}` }))
      )
    )

    return renderingFor({
      arrangement: candidate(best.bestTrial.config),
      bestLoss: best.bestTrial.state.value,
      stage,
      trials: best.trials.length
    })
  }).pipe(
    Effect.provide(Text.TextLayoutLive),
    Effect.mapError((cause) =>
      cause instanceof PlaceBuildError ? cause : new PlaceBuildError({ stage: "render", message: String(cause) })
    )
  )
