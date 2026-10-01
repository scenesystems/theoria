/**
 * GEPA candidate evaluation runtime.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Effect, Inspectable, Option, Ref, Schema, String as Str, Tuple } from "effect"

import type { Examples, Options as GEPAOptions } from "../../../GEPA.js"
import { Result as MetricResult } from "../../../Metric.js"
import { type ModuleParameters, withInstructions as withModuleParamsInstructions } from "../../../ModuleParameters.js"
import { encode as encodePayload } from "../../../Payload.js"
import { withTracing } from "../../../Trace.js"
import { collectModuleParamRefs, type ModuleParamRef } from "../../moduleParameters.js"
import { ReflectiveDatasetSample } from "../model.js"
import { CandidateScoreVector, type ProgramCandidate } from "../model.js"

import { instructionForPredictor } from "./candidateSelection.js"

/**
 * Materialized candidate evaluation rows.
 *
 * @since 0.1.0
 * @category models
 */
export class CandidateEvaluation extends Schema.Class<CandidateEvaluation>(
  "@scenesystems/effect-dsp/internal/gepa/runtime/evaluate/CandidateEvaluation"
)({
  scores: CandidateScoreVector,
  samples: Schema.Array(ReflectiveDatasetSample)
}) {}

/**
 * Selects a contiguous validation-set window while retaining each row's
 * position in the complete score vector.
 *
 * @since 0.1.0
 * @category models
 */
export class CandidateEvaluationWindow extends Schema.Class<CandidateEvaluationWindow>(
  "@scenesystems/effect-dsp/internal/gepa/runtime/evaluate/CandidateEvaluationWindow"
)({
  startIndex: Schema.Number,
  rowCount: Schema.OptionFromSelf(Schema.Number)
}) {}

const FULL_CANDIDATE_EVALUATION_WINDOW = new CandidateEvaluationWindow({
  startIndex: 0,
  rowCount: Option.none()
})

class CandidateEvaluationRow extends Schema.Class<CandidateEvaluationRow>(
  "@scenesystems/effect-dsp/internal/gepa/runtime/evaluate/CandidateEvaluationRow"
)({
  score: Schema.Number,
  samples: Schema.Array(ReflectiveDatasetSample)
}) {}

const candidateParams = (
  owner: ModuleParamRef,
  params: ModuleParameters,
  candidate: ProgramCandidate
): ModuleParameters =>
  withModuleParamsInstructions(
    params,
    Option.getOrElse(instructionForPredictor(candidate, owner.name), () => params.instructions)
  )

type ParameterSnapshot = Schema.Tuple2<Schema.Schema<ModuleParamRef>, typeof ModuleParameters>["Type"]

const setCandidateInstructions = (
  snapshots: Iterable<ParameterSnapshot>,
  candidate: ProgramCandidate
) =>
  Effect.forEach(
    snapshots,
    ([owner, params]) => Ref.set(owner.params, candidateParams(owner, params, candidate)),
    { discard: true }
  ).pipe(Effect.uninterruptible)

const restoreSnapshots = (snapshots: Iterable<ParameterSnapshot>) =>
  Effect.forEach(snapshots, ([owner, params]) => Ref.set(owner.params, params), { discard: true }).pipe(
    Effect.uninterruptible
  )

/**
 * Writes a candidate's instructions to every owned parameter ref without an
 * interruptible partial-commit boundary.
 *
 * @since 0.4.0
 * @category combinators
 */
export const commitCandidateInstructions = (
  owners: Iterable<ModuleParamRef>,
  candidate: ProgramCandidate
) =>
  Effect.forEach(owners, (owner) => Ref.get(owner.params).pipe(Effect.map((params) => Tuple.make(owner, params)))).pipe(
    Effect.flatMap((snapshots) => setCandidateInstructions(snapshots, candidate)),
    Effect.uninterruptible
  )

const resolveValset = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: GEPAOptions<I, O, ME, MR, E, R>
): Examples =>
  Arr.filter(
    Option.getOrElse(Option.fromNullable(options.valset), () => options.trainset),
    (example) => Option.isSome(Option.fromNullable(example.output))
  )

const selectEvaluationRows = (
  examples: Examples,
  window: CandidateEvaluationWindow
) => {
  const available = Arr.drop(
    Arr.map(examples, (example, index) => Tuple.make(index, example)),
    window.startIndex
  )

  return Option.match(window.rowCount, {
    onNone: () => available,
    onSome: (rowCount) => Arr.take(available, rowCount)
  })
}

/**
 * Evaluate one candidate against the resolved validation set.
 *
 * @since 0.1.0
 * @category constructors
 */
export const evaluateCandidate = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: GEPAOptions<I, O, ME, MR, E, R>,
  candidate: ProgramCandidate,
  window: CandidateEvaluationWindow = FULL_CANDIDATE_EVALUATION_WINDOW
) =>
  Effect.acquireUseRelease(
    Effect.forEach(collectModuleParamRefs(options.module), (owner) =>
      Ref.get(owner.params).pipe(Effect.map((params) => Tuple.make(owner, params)))).pipe(
        Effect.tap((snapshots) =>
          setCandidateInstructions(snapshots, candidate)
        )
      ),
    () => {
      const decodeInput = Schema.decodeUnknown(options.module.signature.inputSchema)
      const decodeOutput = Schema.decodeUnknown(options.module.signature.outputSchema)

      return Effect.forEach(selectEvaluationRows(resolveValset(options), window), ([index, example]) =>
        Effect.gen(function*() {
          const expectedOutputRaw = Option.getOrElse(Option.fromNullable(example.output), () =>
            example.input)
          const moduleInput = yield* decodeInput(example.input)
          const expectedOutput = yield* decodeOutput(expectedOutputRaw)
          const [prediction, traceEntries] = yield* withTracing(options.module.forward(moduleInput))
          const programInputs = yield* encodePayload(options.module.signature.inputSchema, moduleInput)
          const programGeneratedOutputs = yield* encodePayload(options.module.signature.outputSchema, prediction)
          const expectedDocument = yield* encodePayload(options.module.signature.outputSchema, expectedOutput)
          const metricResult = yield* options.metric.score(prediction, expectedOutput)
          const normalizedMetric = Option.match(Option.fromNullable(metricResult.feedback), {
            onNone: () => new MetricResult({ score: metricResult.score }),
            onSome: (feedback) => new MetricResult({ score: metricResult.score, feedback })
          })

          const executionSamples = Arr.map(
            Arr.filter(traceEntries, (entry) => Str.Equivalence(entry.outcome, "completed")),
            (entry) =>
              new ReflectiveDatasetSample({
                exampleId: Str.concat("example-", Inspectable.toStringUnknown(index)),
                predictorName: entry.moduleName,
                evidenceScope: "predictor-execution",
                inputs: entry.input,
                generatedOutputs: entry.output,
                expectedOutput: expectedDocument,
                metricResult: normalizedMetric
              })
          )
          const hasRootExecution = Arr.some(
            executionSamples,
            (sample) => Str.Equivalence(sample.predictorName, options.module.name)
          )
          const samples = Boolean.match(hasRootExecution, {
            onTrue: () => executionSamples,
            onFalse: () =>
              Arr.append(
                executionSamples,
                new ReflectiveDatasetSample({
                  exampleId: Str.concat("example-", Inspectable.toStringUnknown(index)),
                  predictorName: options.module.name,
                  evidenceScope: "program",
                  inputs: programInputs,
                  generatedOutputs: programGeneratedOutputs,
                  expectedOutput: expectedDocument,
                  metricResult: normalizedMetric
                })
              )
          })

          return new CandidateEvaluationRow({
            score: metricResult.score,
            samples
          })
        }), { concurrency: "inherit" }).pipe(
          Effect.map((rows) =>
            new CandidateEvaluation({
              scores: Arr.map(rows, (row) =>
                row.score),
              samples: Arr.flatMap(rows, (row) =>
                row.samples)
            })
          )
        )
    },
    restoreSnapshots
  )
