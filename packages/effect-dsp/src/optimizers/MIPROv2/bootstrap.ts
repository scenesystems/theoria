/**
 * Builds Phase 1 demonstration candidates from labeled examples.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Data, Effect, Number as Num, Option, Ref, Schema } from "effect"
import { ModuleParams } from "../../contracts/ModuleParams.js"
import { collectModuleParamRefs } from "../../internal/module-params.js"
import type { Module as DspModule } from "../../Module/model.js"
import type { MIPROExamples } from "./index.js"
import { assemblePredictorCandidates, labeledDemos, Phase1CandidateKind, sortDemos } from "./runtime/anchors.js"
import { normalizeCount, normalizeSeed } from "./runtime/random.js"

/**
 * Decodes the four demonstration layouts produced by Phase 1.
 *
 * @remarks
 * The two `bootstrap-*` variants use existing destination demos (including
 * prior trace bootstrapping) followed by compatible labels, in original or
 * seeded order. Phase 1 does not execute a teacher or collect traces.
 *
 * @since 0.1.0
 * @category models
 */
export const DemoCandidateKindSchema = Phase1CandidateKind

/**
 * Identifies the empty, labeled-prefix, original-order, or seeded-order
 * demonstration layout carried by a candidate.
 *
 * @since 0.1.0
 * @category type-level
 */
export type DemoCandidateKind = Schema.Schema.Type<typeof DemoCandidateKindSchema>

/**
 * Couples a predictor's parameter snapshot with its demonstration layout.
 *
 * @remarks
 * `params` retains the predictor's non-demonstration settings and appends a
 * Phase 1 marker to its instructions. Phase 3 replaces those marked
 * instructions with an instruction candidate before evaluation.
 *
 * @since 0.1.0
 * @category models
 */
export class DemoCandidate extends Schema.Class<DemoCandidate>("MIPROv2DemoCandidate")({
  /** Exact parameter-ref name of the candidate's predictor. */
  predictorName: Schema.String,
  /** Demonstration layout used to build this candidate. */
  kind: DemoCandidateKindSchema,
  /** Predictor parameter snapshot containing the selected demonstrations. */
  params: ModuleParams
}) {}

/**
 * Groups the ordered Phase 1 candidates for one predictor name.
 *
 * @since 0.1.0
 * @category models
 */
export class PredictorDemoCandidates extends Schema.Class<PredictorDemoCandidates>("MIPROv2PredictorDemoCandidates")({
  /** Exact parameter-ref name shared by every grouped candidate. */
  predictorName: Schema.String,
  /** Candidates in Phase 1 search order. */
  candidates: Schema.Array(DemoCandidate)
}) {}

/**
 * Ordered Phase 1 candidate sets, one per predictor.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PredictorDemoCandidateSets = Schema.Array(PredictorDemoCandidates)

/**
 * Ordered Phase 1 candidate sets, one per predictor.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PredictorDemoCandidateSets = typeof PredictorDemoCandidateSets.Type

/**
 * Configures labeled demonstration selection for every owned predictor.
 *
 * @typeParam I - Input fields accepted by the module tree.
 * @typeParam O - Output fields carried by labeled demonstrations.
 *
 * @since 0.1.0
 * @category models
 */
export class GenerateDemoCandidatesOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> extends Data.Class<{
  /** Root whose parameter refs are read without mutation. */
  readonly module: DspModule<I, O, E, R>
  /** Source examples; entries without `output` are excluded from every candidate. */
  readonly trainset: MIPROExamples
  /** Total candidates per predictor, normalized to a positive integer. */
  readonly numCandidates: number
  /** Seed used to order shuffled candidates. Defaults to `1` after normalization. */
  readonly seed?: number
  /** Maximum examples in the `labels-only` candidate. Invalid counts become one. */
  readonly maxLabeledDemos?: number
  /** Maximum examples in each bootstrap-named candidate. Invalid counts become one. */
  readonly maxBootstrappedDemos?: number
}> {}

/**
 * Snapshots every owned predictor and builds its demonstration candidates.
 *
 * @remarks
 * Labeled examples are sorted by total input and output field count. Candidate
 * order begins with zero-shot, labels-only, and original-order bootstrap
 * layouts, truncated when `numCandidates` is below three. Additional slots use
 * seeded orderings and a seeded demonstration count. Inputs and outputs are
 * validated against each destination's encoded signature. Incompatible labels
 * are not candidates for that stage; existing invalid demos fail with a checked
 * ParseError. Stages with no compatible evidence remain zero-shot. Parameter
 * refs remain unchanged; run BootstrapFewShot first to collect stage evidence.
 *
 * @param options - Module tree, labeled-example source, candidate count, and limits.
 * @returns Candidate sets in the module tree's parameter-ref order.
 * @typeParam I - Input fields accepted by the module tree.
 * @typeParam O - Output fields carried by labeled demonstrations.
 *
 * @since 0.1.0
 * @category constructors
 */
export const generateDemoCandidates = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
>(
  options: GenerateDemoCandidatesOptions<I, O, E, R>
) =>
  Effect.gen(function*() {
    const refs = collectModuleParamRefs(options.module)
    const requestedCandidates = normalizeCount(options.numCandidates)
    const allLabeled = sortDemos(labeledDemos(options.trainset))
    const maxLabeledDemos = normalizeCount(
      Option.getOrElse(
        Option.fromNullable(options.maxLabeledDemos),
        () => Numeric.max(1, Numeric.min(4, Arr.length(allLabeled)))
      )
    )
    const maxBootstrappedDemos = normalizeCount(
      Option.getOrElse(
        Option.fromNullable(options.maxBootstrappedDemos),
        () => Numeric.max(1, Numeric.min(4, Arr.length(allLabeled)))
      )
    )
    const seed = normalizeSeed(Option.getOrElse(Option.fromNullable(options.seed), () => 1))

    return yield* Effect.forEach(refs, (ref, predictorIndex) =>
      Effect.gen(function*() {
        const params = yield* Ref.get(ref.params)
        const compatibleLabels = Arr.getSomes(
          yield* Effect.forEach(allLabeled, (demo) => ref.demoContract.decode(demo).pipe(Effect.option))
        )
        const existing = yield* Effect.forEach(params.demos, ref.demoContract.decode)
        const assembledCandidates = assemblePredictorCandidates({
          predictorName: ref.name,
          params,
          demos: compatibleLabels,
          bootstrappedDemos: Arr.appendAll(existing, compatibleLabels),
          requestedCandidates,
          maxLabeledDemos,
          maxBootstrappedDemos,
          seed: Num.sum(seed, predictorIndex)
        })

        return new PredictorDemoCandidates({
          predictorName: ref.name,
          candidates: Arr.map(
            assembledCandidates,
            (candidate) =>
              new DemoCandidate({
                predictorName: ref.name,
                kind: candidate.kind,
                params: candidate.params
              })
          )
        })
      }))
  })
