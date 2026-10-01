/**
 * Builds Phase 1 demonstration candidates from labeled examples.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { normalizeDeterministicSeed, normalizePositiveCount } from "@scenesystems/effect-search/Sampler"
import { Array as Arr, Effect, Number as Num, Option, Ref } from "effect"
import type { Schema } from "effect"
import { DemoCandidate, type GenerateDemoCandidatesOptions, PredictorDemoCandidates } from "../../MIPROv2Candidates.js"
import { collectModuleParamRefs } from "../moduleParameters.js"
import { assemblePredictorCandidates, labeledDemos, sortDemos } from "./runtime/anchors.js"

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
    const requestedCandidates = normalizePositiveCount(options.numCandidates)
    const allLabeled = sortDemos(labeledDemos(options.trainset))
    const maxLabeledDemos = normalizePositiveCount(
      Option.getOrElse(
        Option.fromNullable(options.maxLabeledDemos),
        () => Numeric.max(1, Numeric.min(4, Arr.length(allLabeled)))
      )
    )
    const maxBootstrappedDemos = normalizePositiveCount(
      Option.getOrElse(
        Option.fromNullable(options.maxBootstrappedDemos),
        () => Numeric.max(1, Numeric.min(4, Arr.length(allLabeled)))
      )
    )
    const seed = normalizeDeterministicSeed(Option.getOrElse(Option.fromNullable(options.seed), () => 1))

    return yield* Effect.forEach(refs, (ref, predictorIndex) =>
      Effect.gen(function*() {
        const params = yield* Ref.get(ref.params)
        const compatibleLabels = Arr.getSomes(
          yield* Effect.forEach(allLabeled, (demo) => ref.demonstrationCodec.decode(demo).pipe(Effect.option))
        )
        const existing = yield* Effect.forEach(params.demos, ref.demonstrationCodec.decode)
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
