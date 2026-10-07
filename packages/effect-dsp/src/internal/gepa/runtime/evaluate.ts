/** GEPA rollout scoring and targeted reflection feedback. @internal */
import type * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Boolean, Chunk, Effect, Option, Record, Ref, Schema, Tuple } from "effect"
import { ParseOutputError } from "../../../DspError.js"
import * as Example from "../../../Example.js"
import type { Examples, Options } from "../../../GEPA.js"
import { Context, type Phase, Score, Target } from "../../../Metric.js"
import { call, type ComposableModule, withParameters } from "../../../Module.js"
import { predictors } from "../../../ModuleGraph.js"
import { withInstructions } from "../../../ModuleParameters.js"
import * as ParameterSet from "../../../ParameterSet.js"
import { encode as encodePayload } from "../../../Payload.js"
import * as Prediction from "../../../Prediction.js"
import type * as Predictor from "../../../Predictor.js"
import { withPredictors } from "../../parameterBinding.js"
import { type ProgramCandidate, ReflectiveDatasetSample } from "../model.js"
import { buildReflectiveDataset } from "../reflect.js"

/** One rollout, retaining a failure instead of manufacturing a prediction. @internal */
export class CandidateRow
  extends Schema.Class<CandidateRow>("@scenesystems/effect-dsp/internal/gepa/runtime/evaluate/CandidateRow")({
    example: Example.Example,
    prediction: Schema.Option(Prediction.schema(Schema.Unknown)),
    score: Score,
    failure: Schema.Option(Schema.String),
    parseFailure: Schema.Option(ParseOutputError)
  })
{}

/** Builds an instruction overlay without mutating the caller. @internal */
export const candidateParameters = (root: ComposableModule, candidate: ProgramCandidate) =>
  Effect.gen(function*() {
    const before = yield* ParameterSet.snapshot(root)
    return {
      ...before,
      ...Record.fromEntries(Arr.map(
        Arr.filter(Arr.fromIterable(predictors(root)), (predictor) => !predictor.frozen),
        (predictor) =>
          Tuple.make(
            predictor.path,
            withInstructions(
              Option.getOrThrow(Record.get(before, predictor.path)),
              Option.getOrThrow(
                Arr.findFirst(candidate.predictorInstructions, (entry) => entry.predictorName === predictor.path)
              ).instruction
            )
          )
      ))
    }
  })

/** Evaluates exactly the requested rows; failures consume rollout budget and score failureScore. @internal */
export const evaluateCandidate = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: Options<I, O, ME, MR, E, R>,
  candidate: ProgramCandidate,
  examples: Examples,
  phase: Phase
) =>
  Effect.gen(function*() {
    const parameters = yield* candidateParameters(options.module, candidate)
    const rows = yield* Effect.forEach(examples, (example) =>
      Effect.gen(function*() {
        const input = yield* Schema.decodeEffect(options.module.signature.inputSchema)(example.input)
        const prediction = yield* call(options.module, input)
        const score = yield* options.metric.score(
          example,
          prediction,
          new Context({ phase, trace: Option.some(prediction.trace), target: Option.none() })
        )
        return new CandidateRow({
          example,
          prediction: Option.some(prediction),
          score,
          failure: Option.none(),
          parseFailure: Option.none()
        })
      }).pipe(Effect.catch((error) => {
        const message = Option.match(
          Option.liftPredicate(Schema.is(Schema.Struct({ message: Schema.String })))(error),
          {
            onNone: () => "Candidate evaluation failed",
            onSome: (failure) => failure.message
          }
        )
        return Effect.succeed(
          new CandidateRow({
            example,
            prediction: Option.none(),
            score: new Score({
              value: Option.getOrElse(Option.fromUndefinedOr(options.failureScore), () => 0),
              feedback: Option.some(message)
            }),
            failure: Option.some(message),
            parseFailure: Option.liftPredicate(Schema.is(ParseOutputError))(error)
          })
        )
      })), { concurrency: Option.getOrElse(Option.fromUndefinedOr(options.numThreads), () => 1) }).pipe(
        withParameters(parameters),
        withPredictors(predictors(options.module))
      )
    return { rows, scores: Arr.map(rows, (row) => row.score.value) }
  })

/** Feedback calls are additional metric invocations, deliberately outside the rollout budget. @internal */
export const reflectiveSamples = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: Options<I, O, ME, MR, E, R>,
  rows: ReadonlyArray<CandidateRow>,
  components: Chunk.Chunk<Predictor.Path>,
  rng: PseudoRandom.CPython
) =>
  Effect.gen(function*() {
    const feedbackCalls = yield* Ref.make(0)
    const entries = yield* Effect.forEach(components, (path) =>
      Effect.gen(function*() {
        const predictor = Option.getOrThrow(
          Arr.findFirst(Arr.fromIterable(predictors(options.module)), (predictor) => predictor.path === path)
        )
        const samples = yield* Effect.forEach(rows, (row) =>
          Effect.gen(function*() {
            const failure = Option.flatMap(row.parseFailure, (error) =>
              Option.map(Option.fromUndefinedOr(error.context), (context) => ({ error, context })))
            const formatFailure = Option.filter(failure, (entry) =>
              Option.getOrElse(Option.fromUndefinedOr(options.addFormatFailureAsFeedback), () =>
                false) &&
              entry.context.predictorPath === path)
            return yield* Option.match(formatFailure, {
              onSome: (entry) =>
                Effect.gen(function*() {
                  return Option.some(
                    new ReflectiveDatasetSample({
                      exampleId: yield* Example.id(row.example),
                      predictorName: path,
                      evidenceScope: "predictor-execution",
                      inputs: entry.context.input,
                      generatedOutputs: yield* encodePayload(
                        Schema.String,
                        // Byte-identical to DSPy's make_reflective_dataset failed-parse text.
                        `Couldn't parse the output as per the expected output format. The model's raw response was:\n\`\`\`\n${
                          Option.getOrElse(entry.error.rawOutput, () =>
                            "")
                        }\n\`\`\`\n\n`
                      ),
                      expectedOutput: yield* encodePayload(
                        Schema.Json,
                        yield* Schema.decodeUnknownEffect(Schema.Json)(
                          Option.getOrElse(row.example.labels, Record.empty)
                        )
                      ),
                      metricResult: row.score,
                      parseFailureStructure: entry.context.prompt
                    })
                  )
                }),
              onNone: () =>
                Option.match(row.prediction, {
                  onNone: () =>
                    Effect.succeed(Option.none<ReflectiveDatasetSample>()),
                  onSome: (value) =>
                    Effect.gen(function*() {
                      const prediction = new Prediction.Prediction(value)
                      const executions = Chunk.filter(prediction.trace.selected, (entry) =>
                        entry.moduleName === predictor.name && entry.outcome === "completed")
                      return yield* Boolean.match(Chunk.isEmpty(executions), {
                        onTrue: () =>
                          Effect.succeed(Option.none<ReflectiveDatasetSample>()),
                        onFalse: () =>
                          Effect.gen(function*() {
                            const execution = yield* rng.choice(executions)
                            yield* Ref.update(feedbackCalls, (count) =>
                              count + 1)
                            const feedback = yield* options.metric.score(
                              row.example,
                              prediction,
                              new Context({
                                phase: "reflect",
                                trace: Option.some(prediction.trace),
                                target: Option.some(new Target({ predictorId: path, execution: execution.execution }))
                              })
                            )
                            const expectedOutput = yield* encodePayload(
                              Schema.Json,
                              yield* Schema.decodeUnknownEffect(Schema.Json)(
                                Option.getOrElse(row.example.labels, Record.empty)
                              )
                            )
                            return Option.some(
                              new ReflectiveDatasetSample({
                                exampleId: yield* Example.id(row.example),
                                predictorName: path,
                                evidenceScope: "predictor-execution",
                                inputs: execution.input,
                                generatedOutputs: execution.output,
                                expectedOutput,
                                metricResult: new Score({
                                  value: row.score.value,
                                  feedback: Option.some(
                                    Option.getOrElse(feedback.feedback, () =>
                                      `This trajectory got a score of ${feedback.value}.`)
                                  )
                                })
                              })
                            )
                          })
                      })
                    })
                })
            })
          }))
        return Tuple.make(path, buildReflectiveDataset(Arr.getSomes(samples)))
      }))
    return { examples: Record.fromEntries(entries), feedbackCalls: yield* Ref.get(feedbackCalls) }
  })
