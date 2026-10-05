/**
 * GEPA candidate evaluation runtime.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Effect, Inspectable, Option, Record, Schema, String as Str, Tuple } from "effect"

import type { Examples, Options as GEPAOptions } from "../../../GEPA.js"
import { Context } from "../../../Metric.js"
import { call, type ComposableModule, withParameters } from "../../../Module.js"
import { predictors } from "../../../ModuleGraph.js"
import { withInstructions } from "../../../ModuleParameters.js"
import * as ParameterSet from "../../../ParameterSet.js"
import { encode as encodePayload } from "../../../Payload.js"
import { withPredictors } from "../../parameterBinding.js"
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
      Arr.filter(Arr.fromIterable(predictors(root)), (predictor) => !predictor.frozen),
      (predictor) => {
        const parameters = Option.getOrThrow(Record.get(before, predictor.path))
        return Tuple.make(
          predictor.path,
          withInstructions(
            parameters,
            Option.getOrElse(instructionForPredictor(candidate, predictor.name), () => parameters.instructions)
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
    (example) => Option.isSome(example.labels)
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

    return Effect.forEach(selectEvaluationRows(resolveValset(options), window), ([index, example]) =>
      Effect.gen(function*() {
        const labels = Option.getOrElse(example.labels, Record.empty)
        const moduleInput = yield* decodeInput(example.input)
        const prediction = yield* call(options.module, moduleInput)
        const programInputs = yield* encodePayload(options.module.signature.inputSchema, moduleInput)
        const programGeneratedOutputs = yield* encodePayload(options.module.signature.outputSchema, prediction.output)
        const expectedDocument = yield* encodePayload(
          Schema.Json,
          yield* Schema.decodeUnknownEffect(Schema.Json)(labels)
        )
        const metricResult = yield* options.metric.score(
          example,
          prediction,
          new Context({
            phase: "search",
            trace: Option.some(prediction.trace),
            target: Option.none()
          })
        )

        const executionSamples = Arr.map(
          Arr.filter(prediction.trace.selected, (entry) =>
            Str.Equivalence(entry.outcome, "completed")),
          (entry) =>
            new ReflectiveDatasetSample({
              exampleId: Str.concat("example-", Inspectable.toStringUnknown(index)),
              predictorName: entry.moduleName,
              evidenceScope: "predictor-execution",
              inputs: entry.input,
              generatedOutputs: entry.output,
              expectedOutput: expectedDocument,
              metricResult
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
                metricResult
              })
            )
        })

        return new CandidateEvaluationRow({
          score: metricResult.value,
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
        withPredictors(predictors(options.module))
      )
  })
