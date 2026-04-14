/**
 * Phase 3 trial ref ownership.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Effect, Option, Ref } from "effect"
import type { BestAveragingCandidate } from "./model.js"

/**
 * **Mutable state** carried across the Bayesian search loop.
 *
 * Bundles the `Ref` cells that `evaluateTrial` reads and writes on every
 * iteration — trial counter, running-best score, the best-averaging
 * candidate so far, and the indices that distinguish full-evaluation
 * checkpoints from minibatch-only trials.
 *
 * @since 0.1.0
 * @category refs
 * @see {@link Phase3TrialRefs.allocate} — allocator
 */
export type Phase3TrialRefs = Readonly<{
  readonly trialCounter: Ref.Ref<number>
  readonly bestScoreRef: Ref.Ref<number>
  readonly bestAveragingRef: Ref.Ref<Option.Option<BestAveragingCandidate>>
  readonly fullEvalTrialsRef: Ref.Ref<ReadonlyArray<number>>
  readonly minibatchTrialsRef: Ref.Ref<ReadonlyArray<number>>
}>

/**
 * Allocates a fresh set of `Ref` cells for a Phase 3 search run.
 *
 * The trial counter starts at `0`, the best score at `−∞`, and both
 * trial-index arrays start empty. Call once before entering the search
 * loop.
 *
 * @since 0.1.0
 * @category constructors
 */
export const Phase3TrialRefs = {
  allocate: Effect.gen(function*() {
    const trialCounter = yield* Ref.make(0)
    const bestScoreRef = yield* Ref.make(Number.NEGATIVE_INFINITY)
    const bestAveragingRef = yield* Ref.make<Option.Option<BestAveragingCandidate>>(Option.none())
    const fullEvalTrialsRef = yield* Ref.make<ReadonlyArray<number>>(Arr.empty<number>())
    const minibatchTrialsRef = yield* Ref.make<ReadonlyArray<number>>(Arr.empty<number>())

    return {
      trialCounter,
      bestScoreRef,
      bestAveragingRef,
      fullEvalTrialsRef,
      minibatchTrialsRef
    }
  })
}
