/**
 * Generates Phase 2 instruction candidates from dataset and demonstration context.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  HashMap,
  Number as Num,
  Option,
  Schema,
  String as Str
} from "effect"
import { Documents as DemoDocuments } from "../../Demonstration.js"
import { InstructionProposalFailed } from "../../DspError.js"
import {
  InstructionCandidate,
  type PredictorDemoCandidates,
  type PredictorDemoCandidateSets,
  PredictorInstructionCandidates,
  type ProposeInstructionCandidatesOptions
} from "../../MIPROv2Candidates.js"
import { predictors } from "../../ModuleGraph.js"
import type { ModuleParameters } from "../../ModuleParameters.js"
import type * as Predictor from "../../Predictor.js"
import { CurrentRole } from "../modelRole.js"
import { generateText } from "../module/textGeneration.js"
import * as Binding from "../parameterBinding.js"
import {
  proposalIndices,
  proposalMarker,
  resolveDiversityTemperature,
  resolveSeed,
  resolveTipVocabulary,
  tipAt
} from "./runtime/policy.js"
import { buildProposalPrompt, datasetSummary, ProposalPromptOptions } from "./runtime/prompt.js"

const indexDemoCandidateSets = (
  refs: ReadonlyArray<Predictor.Predictor>,
  candidateSets: PredictorDemoCandidateSets
) =>
  Effect.reduce(
    candidateSets,
    () => HashMap.empty<string, PredictorDemoCandidates>(),
    (setsByName, candidateSet) =>
      Effect.gen(function*() {
        const predictorIndex = yield* Effect.fromOption(
          Arr.findFirstIndex(refs, (ref) => Str.Equivalence(ref.name, candidateSet.predictorName)),
          () =>
            new InstructionProposalFailed({
              message: Str.concat(
                Str.concat("Unknown demo candidates for predictor '", candidateSet.predictorName),
                "'"
              ),
              predictorIndex: -1
            })
        )
        yield* Bool.match(HashMap.has(setsByName, candidateSet.predictorName), {
          onTrue: () =>
            Effect.fail(
              new InstructionProposalFailed({
                message: Str.concat(
                  Str.concat("Duplicate demo candidates for predictor '", candidateSet.predictorName),
                  "'"
                ),
                predictorIndex
              })
            ),
          onFalse: () => Effect.void
        })
        yield* Effect.forEach(candidateSet.candidates, (candidate) =>
          Bool.match(Str.Equivalence(candidate.predictorName, candidateSet.predictorName), {
            onTrue: () => Effect.void,
            onFalse: () =>
              Effect.fail(
                new InstructionProposalFailed({
                  message: Arr.join(
                    Arr.make(
                      "Demo candidate for predictor '",
                      candidateSet.predictorName,
                      "' identifies predictor '",
                      candidate.predictorName,
                      "'"
                    ),
                    ""
                  ),
                  predictorIndex
                })
              )
          }), { discard: true })
        return HashMap.set(setsByName, candidateSet.predictorName, candidateSet)
      })
  )

const baselineCandidate = (predictorName: string, instruction: string): InstructionCandidate =>
  new InstructionCandidate({
    predictorName,
    instruction,
    tip: "baseline",
    cacheBustMarker: proposalMarker(predictorName, 0, 0),
    prompt: "baseline",
    isBaseline: true
  })

class ResolvedPredictor extends Data.Class<{
  readonly ref: Predictor.Predictor
  readonly predictorIndex: number
  readonly demoSet: PredictorDemoCandidates
  readonly parameters: ModuleParameters
}> {}

const RenderedDemos = Schema.Array(DemoDocuments)
const RenderedDemoCandidates = Schema.Array(RenderedDemos)

class PreparedPredictor extends Data.Class<{
  readonly ref: Predictor.Predictor
  readonly predictorIndex: number
  readonly parameters: ModuleParameters
  readonly renderedDemoCandidates: typeof RenderedDemoCandidates.Type
  readonly firstDemos: typeof RenderedDemos.Type
}> {}

const resolvePredictor = (
  ref: Predictor.Predictor,
  predictorIndex: number,
  candidateSets: HashMap.HashMap<string, PredictorDemoCandidates>
) =>
  Effect.gen(function*() {
    const demoSet = yield* Effect.fromOption(HashMap.get(candidateSets, ref.name), () =>
      new InstructionProposalFailed({
        message: Str.concat(Str.concat("Missing demo candidates for predictor '", ref.name), "'"),
        predictorIndex
      }))
    yield* Effect.asVoid(Effect.fromOption(Arr.head(demoSet.candidates), () =>
      new InstructionProposalFailed({
        message: Str.concat(Str.concat("Demo candidate set for predictor '", ref.name), "' is empty"),
        predictorIndex
      })))
    const parameters = yield* Binding.read(ref.parameters, ref.name)
    return new ResolvedPredictor({ ref, predictorIndex, demoSet, parameters })
  })

const preparePredictor = (resolved: ResolvedPredictor) =>
  Effect.gen(function*() {
    const renderedDemoCandidates = yield* Effect.forEach(
      resolved.demoSet.candidates,
      (candidate) => Effect.forEach(candidate.parameters.demos, resolved.ref.demonstrationCodec.encode)
    )
    const firstDemos = yield* Effect.fromOption(Arr.head(renderedDemoCandidates), () =>
      new InstructionProposalFailed({
        message: Str.concat(Str.concat("Demo candidate set for predictor '", resolved.ref.name), "' is empty"),
        predictorIndex: resolved.predictorIndex
      }))
    return new PreparedPredictor({
      ref: resolved.ref,
      predictorIndex: resolved.predictorIndex,
      parameters: resolved.parameters,
      renderedDemoCandidates,
      firstDemos
    })
  })

/**
 * Generates ordered instruction candidates without mutating module parameters.
 *
 * @remarks
 * Predictors and their generated alternatives run sequentially. Each proposal
 * uses one Phase 1 candidate in cyclic order and sends a plain-text prompt to
 * the configured language model. Every supplied set must uniquely identify an
 * owned predictor, and every candidate must identify its enclosing set's predictor.
 * Missing, empty, duplicate, unknown, or misbound Phase 1 candidates fail with
 * `InstructionProposalFailed`. All identities and destination wire demonstrations
 * are preflighted before any model call; invalid demonstrations retain their
 * checked `ParseError`. Provider failures become `InstructionProposalFailed`
 * without retaining provider details.
 *
 * @param options - Module tree, Phase 1 context, total candidate count, and prompt hints.
 * @returns Candidate sets in the module tree's parameter-ref order.
 * @typeParam I - Input fields used to describe the module and prompt examples.
 * @typeParam O - Output fields used to describe the module and prompt examples.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al. (2024)}
 * @since 0.1.0
 * @category constructors
 */
export const proposeInstructionCandidates = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
>(
  options: ProposeInstructionCandidatesOptions<I, O, E, R>
) =>
  Effect.gen(function*() {
    const refs = Arr.filter(Arr.fromIterable(predictors(options.module)), (entry) => !entry.frozen)
    const requested = proposalIndices(options.numInstructions)
    const seed = resolveSeed(options.seed)
    const tips = resolveTipVocabulary(options.tipVocabulary)
    const summary = datasetSummary(options.trainset)
    const diversityTemperature = resolveDiversityTemperature(options.diversityTemperature)
    const candidateSetsByName = yield* indexDemoCandidateSets(refs, options.demoCandidates)
    const resolved = yield* Effect.forEach(
      refs,
      (ref, predictorIndex) => resolvePredictor(ref, predictorIndex, candidateSetsByName),
      { concurrency: 1 }
    )
    const prepared = yield* Effect.forEach(resolved, preparePredictor, { concurrency: 1 })

    return yield* Effect.forEach(prepared, ({ firstDemos, parameters, predictorIndex, ref, renderedDemoCandidates }) =>
      Effect.gen(function*() {
        const generated = yield* Effect.forEach(
          requested,
          (proposalOffset) =>
            Effect.gen(function*() {
              const proposalIndex = Num.increment(proposalOffset)
              const tip = tipAt(tips, Num.sum(Num.sum(seed, predictorIndex), proposalIndex))
              const marker = proposalMarker(ref.name, proposalIndex, seed)
              const demos = Option.getOrElse(
                Arr.get(
                  renderedDemoCandidates,
                  Num.remainder(proposalOffset, Arr.length(renderedDemoCandidates))
                ),
                () =>
                  firstDemos
              )
              const prompt = buildProposalPrompt(
                new ProposalPromptOptions({
                  marker,
                  predictorName: ref.name,
                  moduleDescription: options.module.signature.description,
                  summary,
                  tip,
                  demos,
                  baselineInstruction: parameters.instructions,
                  diversityTemperature
                })
              )
              const proposed = yield* generateText(prompt).pipe(
                Effect.provideService(CurrentRole, "proposer"),
                Effect.mapError(
                  () =>
                    new InstructionProposalFailed({
                      message: Str.concat(
                        Str.concat("Failed to propose instruction for predictor '", ref.name),
                        "'"
                      ),
                      predictorIndex
                    })
                )
              )

              return new InstructionCandidate({
                predictorName: ref.name,
                instruction: proposed,
                tip,
                cacheBustMarker: marker,
                prompt,
                isBaseline: false
              })
            }),
          { concurrency: 1 }
        )

        return new PredictorInstructionCandidates({
          predictorName: ref.name,
          candidates: Arr.appendAll(Arr.make(baselineCandidate(ref.name, parameters.instructions)), generated)
        })
      }), { concurrency: 1 })
  }).pipe(Binding.withPredictors(predictors(options.module)))
