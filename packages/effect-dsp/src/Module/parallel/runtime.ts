/**
 * `parallel` forward runtime orchestration.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import type { Schema } from "effect"
import { Array as Arr, Chunk, Effect, Either, Match, Option } from "effect"
import { Usage } from "../../contracts/Usage.js"
import type { DspError, ParallelBranchFailure, ParallelExecutionError } from "../../Errors/index.js"
import * as Trace from "../../Trace/index.js"
import type { Module } from "../model.js"
import { ParallelFailure } from "./runtime/errors.js"
import { type BranchResult, ParallelEvidence } from "./runtime/evidence.js"
import { PARALLEL_OUTPUTS_FIELD, type ParallelInputFields, type ParallelOutputFields } from "./signatures.js"

const runBranch = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly branchIndex: number
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly module: Module<I, O>
}) =>
  Effect.gen(function*() {
    const [[output, traces], usage] = yield* Trace.withUsageTracking(
      Trace.withTracing(options.module.forward(options.input)).pipe(
        Effect.locally(Trace.TraceRef, Arr.empty<Trace.Entry>())
      )
    ).pipe(Effect.locally(Trace.UsageRef, Usage.empty))

    const branchResult: BranchResult<O> = {
      branchIndex: options.branchIndex,
      output,
      traces,
      usage
    }

    return branchResult
  })
const failFastExecution = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly concurrency: number
  readonly inputs: ReadonlyArray<Schema.Schema.Type<Schema.Struct<I>>>
  readonly module: Module<I, O>
  readonly moduleName: string
}) =>
  Effect.forEach(
    options.inputs,
    (input, branchIndex) =>
      runBranch({
        branchIndex,
        input,
        module: options.module
      }).pipe(
        Effect.mapError((error) =>
          ParallelFailure.execution({
            moduleName: options.moduleName,
            failurePolicy: "fail-fast",
            failures: Arr.of(
              ParallelFailure.branch({
                branchIndex,
                branchModuleName: options.module.name,
                error
              })
            )
          })
        )
      ),
    { concurrency: options.concurrency }
  )

const collectAllExecution = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly concurrency: number
  readonly inputs: ReadonlyArray<Schema.Schema.Type<Schema.Struct<I>>>
  readonly module: Module<I, O>
  readonly moduleName: string
}) =>
  Effect.gen(function*() {
    const outcomes = yield* Effect.forEach(
      options.inputs,
      (input, branchIndex) =>
        runBranch({
          branchIndex,
          input,
          module: options.module
        }).pipe(Effect.either),
      { concurrency: options.concurrency }
    )
    const failures = Arr.filterMap(outcomes, (outcome, branchIndex) =>
      Either.match(outcome, {
        onLeft: (error) =>
          Option.some(
            ParallelFailure.branch({
              branchIndex,
              branchModuleName: options.module.name,
              error
            })
          ),
        onRight: () => Option.none<ParallelBranchFailure>()
      }))
    const successes = Arr.filterMap(outcomes, Either.getRight)

    return yield* Match.value(failures.length).pipe(
      Match.when((count) => count > 0, () =>
        Effect.fail(
          ParallelFailure.execution({
            moduleName: options.moduleName,
            failurePolicy: "collect-all",
            failures
          })
        )),
      Match.orElse(() => Effect.succeed(successes))
    )
  })

/**
 * Build the typed forward function for `Module.parallel`.
 *
 * @since 0.2.0
 * @internal
 */
export const ParallelRuntime = {
  forward: <
    I extends Schema.Struct.Fields,
    O extends Schema.Struct.Fields
  >(options: {
    readonly concurrency: number
    readonly failurePolicy: ParallelExecutionError["failurePolicy"]
    readonly module: Module<I, O>
    readonly moduleName: string
  }): Module<ParallelInputFields<I>, ParallelOutputFields<O>>["forward"] =>
    Effect.fn(options.moduleName)((input) =>
      Effect.gen(function*() {
        const inputs = Chunk.toReadonlyArray(Chunk.fromIterable(input.inputs))
        const branches = yield* Match.value(options.failurePolicy).pipe(
          Match.when("fail-fast", () =>
            failFastExecution({
              concurrency: options.concurrency,
              inputs,
              module: options.module,
              moduleName: options.moduleName
            })),
          Match.when("collect-all", () =>
            collectAllExecution({
              concurrency: options.concurrency,
              inputs,
              module: options.module,
              moduleName: options.moduleName
            })),
          Match.exhaustive
        )

        yield* ParallelEvidence.append(branches)

        return {
          [PARALLEL_OUTPUTS_FIELD]: Arr.map(branches, (branch) => branch.output)
        }
      }).pipe(Effect.mapError((error): AiError.AiError | DspError => error))
    )
}
