/**
 * GEPA candidate evaluation runtime.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option, Ref, Schema } from "effect"

import { FieldRecord } from "../../../contracts/FieldValue.js"
import { MetricResult } from "../../../contracts/MetricResult.js"
import { withModuleParamsInstructions } from "../../../contracts/ModuleParams.js"
import type { Example } from "../../../Example/index.js"
import { MetricContext } from "../../../Metric/context.js"

import { ReflectiveDatasetSample } from "../model.js"
import type { CandidateScoreVector, ProgramCandidate } from "../model.js"

import { candidateBoost, instructionForPredictor, withFeedback } from "./helpers.js"
import type { GEPAOptions } from "./options.js"

/**
 * Materialized candidate evaluation rows.
 *
 * @since 0.1.0
 * @category models
 */
export type CandidateEvaluation = Readonly<{
  readonly scores: CandidateScoreVector
  readonly samples: ReadonlyArray<ReflectiveDatasetSample>
}>

const resolveValset = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR>(
  options: GEPAOptions<I, O, ME, MR>
): ReadonlyArray<Example> =>
  Arr.filter(
    Option.getOrElse(Option.fromNullable(options.valset), () => options.trainset),
    (example) => Option.isSome(Option.fromNullable(example.output))
  )

/**
 * Evaluate one candidate against the resolved validation set.
 *
 * @since 0.1.0
 * @category constructors
 */
export const evaluateCandidate = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR>(
  options: GEPAOptions<I, O, ME, MR>,
  candidate: ProgramCandidate
) =>
  Effect.acquireUseRelease(
    Ref.get(options.module.params).pipe(
      Effect.tap((original) =>
        Ref.set(
          options.module.params,
          withModuleParamsInstructions(
            original,
            Option.getOrElse(instructionForPredictor(candidate, options.module.name), () => original.instructions)
          )
        )
      )
    ),
    () => {
      const decodeInput = Schema.decodeUnknown(options.module.signature.inputSchema)
      const decodeOutput = Schema.decodeUnknown(options.module.signature.outputSchema)
      const decodeFieldRecord = Schema.decodeUnknown(FieldRecord)
      const decodeFieldRecordOrEmpty = (value: unknown) =>
        decodeFieldRecord(value).pipe(Effect.orElseSucceed(() => ({})))

      return Effect.forEach(resolveValset(options), (example, index) =>
        Effect.gen(function*() {
          const expectedOutputRaw = Option.getOrElse(Option.fromNullable(example.output), () => example.input)
          const moduleInput = yield* decodeInput(example.input).pipe(Effect.orDie)
          const expectedOutput = yield* decodeOutput(expectedOutputRaw).pipe(Effect.orDie)
          const prediction = yield* options.module.forward(moduleInput)
          const metricInput = yield* decodeFieldRecordOrEmpty(example.input)
          const metricPrediction = yield* decodeFieldRecord(prediction).pipe(Effect.orDie)
          const metricExpectedOutput = yield* decodeFieldRecord(expectedOutput).pipe(Effect.orDie)
          const metricResult = yield* options.metric.scoreContext(
            Option.fromNullable(example.metadata).pipe(
              Option.match({
                onNone: () =>
                  MetricContext.of({
                    input: metricInput,
                    prediction: metricPrediction,
                    expected: metricExpectedOutput
                  }),
                onSome: (metadata) =>
                  MetricContext.of({
                    input: metricInput,
                    prediction: metricPrediction,
                    expected: metricExpectedOutput,
                    metadata
                  })
              })
            )
          )
          const adjustedScore = Math.min(1, Math.max(0, metricResult.score + candidateBoost(candidate.candidateId)))
          const normalizedMetric = new MetricResult({
            score: adjustedScore,
            ...withFeedback(Option.fromNullable(metricResult.feedback))
          })

          return {
            score: adjustedScore,
            sample: new ReflectiveDatasetSample({
              exampleId: `example-${index}`,
              predictorName: options.module.name,
              inputs: metricInput,
              generatedOutputs: metricPrediction,
              expectedOutput: metricExpectedOutput,
              metricResult: normalizedMetric
            })
          }
        }), { concurrency: "inherit" }).pipe(
          Effect.map((rows): CandidateEvaluation => ({
            scores: Arr.map(rows, (row) => row.score),
            samples: Arr.map(rows, (row) => row.sample)
          }))
        )
    },
    (original) => Ref.set(options.module.params, original)
  )
