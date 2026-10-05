/**
 * GEPA candidate evaluation runtime.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Effect, Inspectable, Option, Record, Schema, String as Str, Tuple } from "effect"

import type { Examples, Options as GEPAOptions } from "../../../GEPA.js"
import { Result as MetricResult } from "../../../Metric.js"
import { type ComposableModule, withParameters } from "../../../Module.js"
import { predictors } from "../../../ModuleGraph.js"
import { withInstructions } from "../../../ModuleParameters.js"
import * as ParameterSet from "../../../ParameterSet.js"
import { encode as encodePayload } from "../../../Payload.js"
import { withTracing } from "../../../Trace.js"
import { withOwners } from "../../parameterBinding.js"
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
  startIndex: Schema.Finite,
  rowCount: Schema.OptionFromNullishOr(Schema.Finite)
}) {}

const FULL_CANDIDATE_EVALUATION_WINDOW = new CandidateEvaluationWindow({
  startIndex: 0,
  rowCount: Option.none()
})

class CandidateEvaluationRow extends Schema.Class<CandidateEvaluationRow>(
  "@scenesystems/effect-dsp/internal/gepa/runtime/evaluate/CandidateEvaluationRow"
)({
  score: Schema.Finite,
  samples: Schema.Array(ReflectiveDatasetSample)
}) {}

/**
 * Builds a candidate snapshot without changing caller parameters.
 *
 * @since 0.4.0
 * @category combinators
 */
export const candidateParameters = (
  root: ComposableModule,
  candidate: ProgramCandidate
) =>
  Effect.gen(function*() {
    const before = yield* ParameterSet.snapshot(root)
    const replacements = Arr.map(
      Arr.filter(Arr.fromIterable(predictors(root)), (owner) => owner.ownership !== "frozen"),
      (owner) => {
        const params = Option.getOrThrow(Record.get(before, owner.id))
        return Tuple.make(
          owner.id,
          withInstructions(
            params,
            Option.getOrElse(instructionForPredictor(candidate, owner.name), () => params.instructions)
          )
        )
      }
    )
    return { ...before, ...Record.fromEntries(replacements) }
  })

const resolveValset = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: GEPAOptions<I, O, ME, MR, E, R>
): Examples =>
  Arr.filter(
    Option.getOrElse(Option.fromNullishOr(options.valset), () => options.trainset),
    (example) => Option.isSome(Option.fromNullishOr(example.output))
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
  Effect.flatMap(candidateParameters(options.module, candidate), (parameters) => {
    const decodeInput = Schema.decodeUnknownEffect(options.module.signature.inputSchema)
    const decodeOutput = Schema.decodeUnknownEffect(options.module.signature.outputSchema)

    return Effect.forEach(selectEvaluationRows(resolveValset(options), window), ([index, example]) =>
      Effect.gen(function*() {
        const expectedOutputRaw = Option.getOrElse(Option.fromNullishOr(example.output), () =>
          example.input)
        const moduleInput = yield* decodeInput(example.input)
        const expectedOutput = yield* decodeOutput(expectedOutputRaw)
        const [prediction, traceEntries] = yield* withTracing(options.module.forward(moduleInput))
        const programInputs = yield* encodePayload(options.module.signature.inputSchema, moduleInput)
        const programGeneratedOutputs = yield* encodePayload(options.module.signature.outputSchema, prediction)
        const expectedDocument = yield* encodePayload(options.module.signature.outputSchema, expectedOutput)
        const metricResult = yield* options.metric.score(prediction, expectedOutput)
        const normalizedMetric = Option.match(Option.fromNullishOr(metricResult.feedback), {
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
      }), { concurrency: "unbounded" }).pipe(
        Effect.map((rows) =>
          new CandidateEvaluation({
            scores: Arr.map(rows, (row) =>
              row.score),
            samples: Arr.flatMap(rows, (row) =>
              row.samples)
          })
        ),
        withParameters(parameters),
        withOwners(predictors(options.module))
      )
  })
