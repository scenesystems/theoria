/**
 * Phase 1 anchor and candidate assembly — pairs labeled examples with module
 * trace demos.
 *
 * @since 0.1.0
 * @internal
 */
import {
  buildIndices,
  normalizePositiveCount,
  sampleBoundedCount,
  shuffleBySeed
} from "@scenesystems/effect-search/Sampler"
import { Array as Arr, Inspectable, Number as Num, Option, Order, Record, Schema } from "effect"
import { Demonstration as Demo } from "../../../Demonstration.js"
import type { Example } from "../../../Example.js"
import {
  ModuleParameters,
  withDemosAndInstructions as withModuleParamsDemosAndInstructions
} from "../../../ModuleParameters.js"

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
 * @since 0.1.0
 * @category models
 */
export const Phase1CandidateKind = Schema.Literal(
  "zero-shot",
  "labels-only",
  "bootstrap-unshuffled",
  "bootstrap-shuffled"
)

/** @internal */
export type Phase1CandidateKind = typeof Phase1CandidateKind.Type

/**
 * A single Phase 1 candidate pairing a candidate kind with the concrete
 * `ModuleParameters` (instructions + demos) it produced.
 *
 * @since 0.1.0
 * @category models
 * @see {@link Phase1CandidateKind}
 */
export class CandidateAssembly extends Schema.Class<CandidateAssembly>("MIPROv2CandidateAssembly")({
  kind: Phase1CandidateKind,
  params: ModuleParameters
}) {}

const demoOrder: Order.Order<Demo> = Order.mapInput(
  Order.number,
  (demo) => Num.sum(Arr.length(Record.keys(demo.input)), Arr.length(Record.keys(demo.output)))
)

const candidateInstructions = (baseInstructions: string, predictorName: string, marker: string): string =>
  Arr.join(Arr.make(baseInstructions, "\n[miprov2-phase1:", predictorName, ":", marker, "]"), "")

/**
 * Validated destination evidence and limits used to assemble Phase 1 candidates.
 * Labels and bootstrap evidence remain separate, including when either is empty.
 *
 * @since 0.1.0
 * @category models
 */
export const AssemblePredictorCandidatesOptions = Schema.Struct({
  predictorName: Schema.String,
  params: ModuleParameters,
  demos: ModuleParameters.fields.demos,
  bootstrappedDemos: ModuleParameters.fields.demos,
  requestedCandidates: Schema.Number,
  maxLabeledDemos: Schema.Number,
  maxBootstrappedDemos: Schema.Number,
  seed: Schema.Number
})

/** @internal */
export type AssemblePredictorCandidatesOptions = typeof AssemblePredictorCandidatesOptions.Type

/**
 * Extracts labeled examples from a training set, converting each into a
 * `Demo`. Unlabeled examples (those without output) are discarded.
 *
 * @since 0.1.0
 * @category constructors
 */
export const labeledDemos = (trainset: Schema.Array$<typeof Example>["Type"]): ModuleParameters["demos"] =>
  Arr.filterMap(
    trainset,
    (example) => Option.map(Option.fromNullable(example.output), (output) => new Demo({ input: example.input, output }))
  )

/**
 * Sorts demos by ascending field count (sum of input and output keys),
 * placing simpler demonstrations first.
 *
 * @since 0.1.0
 * @category utils
 */
export const sortDemos = (demos: ModuleParameters["demos"]): ModuleParameters["demos"] => Arr.sort(demos, demoOrder)

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
 * @since 0.1.0
 * @category constructors
 * @see {@link Phase1CandidateKind}
 * @see {@link CandidateAssembly}
 */
export const assemblePredictorCandidates = (
  options: AssemblePredictorCandidatesOptions
): Schema.Array$<typeof CandidateAssembly>["Type"] => {
  const normalizedRequested = normalizePositiveCount(options.requestedCandidates)
  const candidate = (kind: Phase1CandidateKind, demos: ModuleParameters["demos"], marker: string) =>
    new CandidateAssembly({
      kind,
      params: withModuleParamsDemosAndInstructions(
        options.params,
        demos,
        candidateInstructions(options.params.instructions, options.predictorName, marker)
      )
    })
  const anchors = Arr.make(
    candidate("zero-shot", Arr.empty(), "zero-shot"),
    candidate("labels-only", Arr.take(options.demos, options.maxLabeledDemos), "labels-only"),
    candidate(
      "bootstrap-unshuffled",
      Arr.take(options.bootstrappedDemos, options.maxBootstrappedDemos),
      "bootstrap-unshuffled"
    )
  )
  const shuffled = Arr.map(
    buildIndices(Num.max(0, Num.subtract(normalizedRequested, Arr.length(anchors)))),
    (index) => {
      const shuffleSeed = Num.increment(Num.sum(options.seed, index))
      const demoCount = sampleBoundedCount(shuffleSeed, options.maxBootstrappedDemos)
      return candidate(
        "bootstrap-shuffled",
        Arr.take(shuffleBySeed(options.bootstrappedDemos, shuffleSeed), demoCount),
        Arr.join(
          Arr.make(
            "shuffled-",
            Inspectable.toStringUnknown(Num.increment(index)),
            "-count-",
            Inspectable.toStringUnknown(demoCount)
          ),
          ""
        )
      )
    }
  )

  return Arr.take(Arr.appendAll(anchors, shuffled), normalizedRequested)
}
