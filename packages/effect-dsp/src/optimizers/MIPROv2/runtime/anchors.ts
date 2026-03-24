/**
 * Phase 1 anchor and candidate assembly — pairs labeled examples with module
 * trace demos.
 *
 * @since 0.0.0
 * @internal
 */
import { Array as Arr, Option, Order, Record } from "effect"
import type { ModuleParams } from "../../../contracts/ModuleParams.js"
import { withModuleParamsDemosAndInstructions } from "../../../contracts/ModuleParams.js"
import { Demo, type Example } from "../../../Example/index.js"
import { buildIndices, normalizeCount, sampleBoundedCount, shuffleBySeed } from "./random.js"

/**
 * Discriminant for the four Phase 1 demo candidate strategies.
 *
 * **Anchors** (always generated first):
 * - `"zero-shot"` — no demonstrations attached
 * - `"labels-only"` — only labeled training examples
 * - `"bootstrap-unshuffled"` — bootstrapped demos in original order
 *
 * **Fill candidates:**
 * - `"bootstrap-shuffled"` — bootstrapped demos in a deterministic random order
 *
 * @since 0.0.0
 * @category models
 */
export type Phase1CandidateKind = "zero-shot" | "labels-only" | "bootstrap-unshuffled" | "bootstrap-shuffled"

/**
 * A single Phase 1 candidate pairing a candidate kind with the concrete
 * `ModuleParams` (instructions + demos) it produced.
 *
 * @since 0.0.0
 * @category models
 * @see {@link Phase1CandidateKind}
 */
export type CandidateAssembly = Readonly<{
  readonly kind: Phase1CandidateKind
  readonly params: ModuleParams
}>

const demoOrder: Order.Order<Demo> = Order.mapInput(
  Order.number,
  (demo) => Record.keys(demo.input).length + Record.keys(demo.output).length
)

const candidateInstructions = (baseInstructions: string, predictorName: string, marker: string): string =>
  `${baseInstructions}\n[miprov2-phase1:${predictorName}:${marker}]`

const candidateParams = (options: {
  readonly params: ModuleParams
  readonly demos: ReadonlyArray<Demo>
  readonly predictorName: string
  readonly marker: string
}): ModuleParams =>
  withModuleParamsDemosAndInstructions(
    options.params,
    options.demos,
    candidateInstructions(options.params.instructions, options.predictorName, options.marker)
  )

const candidate = (kind: Phase1CandidateKind, params: ModuleParams): CandidateAssembly => ({
  kind,
  params
})

const bootstrapShuffledCandidates = (options: {
  readonly predictorName: string
  readonly params: ModuleParams
  readonly demos: ReadonlyArray<Demo>
  readonly maxBootstrappedDemos: number
  readonly required: number
  readonly seed: number
}): ReadonlyArray<CandidateAssembly> =>
  options.required <= 0
    ? Arr.empty<CandidateAssembly>()
    : Arr.map(buildIndices(options.required), (index) => {
      const shuffleSeed = options.seed + index + 1
      const demoCount = sampleBoundedCount(shuffleSeed, options.maxBootstrappedDemos)

      return {
        kind: "bootstrap-shuffled",
        params: candidateParams({
          params: options.params,
          demos: Arr.take(shuffleBySeed(options.demos, shuffleSeed), demoCount),
          predictorName: options.predictorName,
          marker: `shuffled-${index + 1}-count-${demoCount}`
        })
      }
    })

/**
 * Extracts labeled examples from a training set, converting each into a
 * `Demo`. Unlabeled examples (those without output) are discarded.
 *
 * @since 0.0.0
 * @category constructors
 */
export const labeledDemos = (trainset: ReadonlyArray<Example>): ReadonlyArray<Demo> =>
  Arr.filterMap(
    trainset,
    (example) => Option.map(Option.fromNullable(example.output), (output) => new Demo({ input: example.input, output }))
  )

/**
 * Sorts demos by ascending field count (sum of input and output keys),
 * placing simpler demonstrations first.
 *
 * @since 0.0.0
 * @category utils
 */
export const sortDemos = (demos: ReadonlyArray<Demo>): ReadonlyArray<Demo> => Arr.sort(demos, demoOrder)

/**
 * Builds the full set of Phase 1 demo candidates for a single predictor.
 *
 * Three anchor candidates (zero-shot, labels-only, bootstrap-unshuffled)
 * are always created first. Remaining slots up to `requestedCandidates`
 * are filled with deterministically shuffled bootstrap variants.
 *
 * Each candidate embeds a cache-bust marker in its instructions so
 * downstream LLM calls produce distinct completions.
 *
 * @since 0.0.0
 * @category constructors
 * @see {@link Phase1CandidateKind}
 * @see {@link CandidateAssembly}
 */
export const assemblePredictorCandidates = (options: {
  readonly predictorName: string
  readonly params: ModuleParams
  readonly demos: ReadonlyArray<Demo>
  readonly requestedCandidates: number
  readonly maxLabeledDemos: number
  readonly maxBootstrappedDemos: number
  readonly seed: number
}): ReadonlyArray<CandidateAssembly> => {
  const normalizedRequested = normalizeCount(options.requestedCandidates)
  const anchors = Arr.make(
    candidate(
      "zero-shot",
      candidateParams({
        params: options.params,
        demos: Arr.empty<Demo>(),
        predictorName: options.predictorName,
        marker: "zero-shot"
      })
    ),
    candidate(
      "labels-only",
      candidateParams({
        params: options.params,
        demos: Arr.take(options.demos, options.maxLabeledDemos),
        predictorName: options.predictorName,
        marker: "labels-only"
      })
    ),
    candidate(
      "bootstrap-unshuffled",
      candidateParams({
        params: options.params,
        demos: Arr.take(options.demos, options.maxBootstrappedDemos),
        predictorName: options.predictorName,
        marker: "bootstrap-unshuffled"
      })
    )
  )
  const shuffled = bootstrapShuffledCandidates({
    predictorName: options.predictorName,
    params: options.params,
    demos: options.demos,
    maxBootstrappedDemos: options.maxBootstrappedDemos,
    required: Math.max(0, normalizedRequested - anchors.length),
    seed: options.seed
  })

  return Arr.take(Arr.appendAll(anchors, shuffled), normalizedRequested)
}
