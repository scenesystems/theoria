/**
 * MIPROv2 Phase 1 — deterministic demo candidate generation by running the
 * module against training examples and collecting traces.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option, Ref, Schema } from "effect"
import { ModuleParams } from "../../contracts/ModuleParams.js"
import type { Example } from "../../Example/index.js"
import { collectModuleParamRefs } from "../../internal/module-params.js"
import type { Module as DspModule } from "../../Module/model.js"
import { assemblePredictorCandidates, labeledDemos, sortDemos } from "./runtime/anchors.js"
import { normalizeCount, normalizeSeed } from "./runtime/random.js"

/**
 * Phase-1 demo candidate kind.
 *
 * @since 0.1.0
 * @category models
 */
export const DemoCandidateKindSchema = Schema.Literal(
  "zero-shot",
  "labels-only",
  "bootstrap-unshuffled",
  "bootstrap-shuffled"
)

/**
 * Phase-1 demo candidate kind.
 *
 * @since 0.1.0
 * @category type-level
 */
export type DemoCandidateKind = Schema.Schema.Type<typeof DemoCandidateKindSchema>

/**
 * MIPROv2 demo candidate for one predictor.
 *
 * @since 0.1.0
 * @category models
 */
export class DemoCandidate extends Schema.Class<DemoCandidate>("MIPROv2DemoCandidate")({
  predictorName: Schema.String,
  kind: DemoCandidateKindSchema,
  params: ModuleParams
}) {}

/**
 * Phase-1 candidate set per predictor.
 *
 * @since 0.1.0
 * @category models
 */
export class PredictorDemoCandidates extends Schema.Class<PredictorDemoCandidates>("MIPROv2PredictorDemoCandidates")({
  predictorName: Schema.String,
  candidates: Schema.Array(DemoCandidate)
}) {}

/**
 * Phase-1 generation options.
 *
 * @since 0.1.0
 * @category models
 */
export type GenerateDemoCandidatesOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly module: DspModule<I, O>
  readonly trainset: ReadonlyArray<Example>
  readonly numCandidates: number
  readonly seed?: number
  readonly maxLabeledDemos?: number
  readonly maxBootstrappedDemos?: number
}>

/**
 * Build deterministic Phase-1 demo candidates for every discovered predictor.
 *
 * @since 0.1.0
 * @category constructors
 */
export const generateDemoCandidates = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  options: GenerateDemoCandidatesOptions<I, O>
) =>
  Effect.gen(function*() {
    const refs = collectModuleParamRefs(options.module)
    const requestedCandidates = normalizeCount(options.numCandidates)
    const allLabeled = sortDemos(labeledDemos(options.trainset))
    const maxLabeledDemos = normalizeCount(
      Option.getOrElse(
        Option.fromNullable(options.maxLabeledDemos),
        () => Math.max(1, Math.min(4, allLabeled.length))
      )
    )
    const maxBootstrappedDemos = normalizeCount(
      Option.getOrElse(
        Option.fromNullable(options.maxBootstrappedDemos),
        () => Math.max(1, Math.min(4, allLabeled.length))
      )
    )
    const seed = normalizeSeed(Option.getOrElse(Option.fromNullable(options.seed), () => 1))

    return yield* Effect.forEach(refs, (ref, predictorIndex) =>
      Effect.gen(function*() {
        const params = yield* Ref.get(ref.params)
        const assembledCandidates = assemblePredictorCandidates({
          predictorName: ref.name,
          params,
          demos: allLabeled,
          requestedCandidates,
          maxLabeledDemos,
          maxBootstrappedDemos,
          seed: seed + predictorIndex
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
