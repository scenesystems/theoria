/**
 * `parallel` forward runtime orchestration.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import type { Schema } from "effect"
import { Array as Arr, Chunk, Effect, Either, FiberRef, Match, Option } from "effect"
import { emptyUsage, type Usage, Usage as UsageTotals } from "../../contracts/Usage.js"
import { type DspError, ParallelBranchFailure, ParallelExecutionError } from "../../Errors/index.js"
import * as Trace from "../../Trace/index.js"
import type { Module } from "../model.js"
import { PARALLEL_OUTPUTS_FIELD, type ParallelInputFields, type ParallelOutputFields } from "./signatures.js"

type BranchResult<O extends Schema.Struct.Fields> = Readonly<{
  readonly branchIndex: number
  readonly output: Schema.Schema.Type<Schema.Struct<O>>
  readonly traces: ReadonlyArray<Trace.Entry>
  readonly usage: Usage
}>

const errorTag = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(
      (
        candidate: unknown
      ): candidate is { readonly _tag: string } =>
        typeof candidate === "object" && candidate !== null && "_tag" in candidate &&
        typeof candidate._tag === "string",
      (candidate) => candidate._tag
    ),
    Match.orElse(() => "AiError")
  )

const errorMessage = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(
      (
        candidate: unknown
      ): candidate is { readonly message: string } =>
        typeof candidate === "object"
        && candidate !== null
        && "message" in candidate
        && typeof candidate.message === "string",
      (candidate) => candidate.message
    ),
    Match.when(
      (
        candidate: unknown
      ): candidate is { readonly description: string } =>
        typeof candidate === "object"
        && candidate !== null
        && "description" in candidate
        && typeof candidate.description === "string",
      (candidate) => candidate.description
    ),
    Match.orElse((candidate) => String(candidate))
  )

const branchFailure = (options: {
  readonly branchIndex: number
  readonly branchModuleName: string
  readonly error: unknown
}) =>
  new ParallelBranchFailure({
    branchIndex: options.branchIndex,
    branchModuleName: options.branchModuleName,
    errorTag: errorTag(options.error),
    message: errorMessage(options.error)
  })

const parallelExecutionError = (options: {
  readonly moduleName: string
  readonly failurePolicy: ParallelExecutionError["failurePolicy"]
  readonly failures: ReadonlyArray<ParallelBranchFailure>
}) =>
  new ParallelExecutionError({
    message: `Parallel execution failed under ${options.failurePolicy}.`,
    moduleName: options.moduleName,
    failurePolicy: options.failurePolicy,
    failures: Arr.fromIterable(options.failures)
  })

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
    ).pipe(Effect.locally(Trace.UsageRef, emptyUsage))

    const branchResult: BranchResult<O> = {
      branchIndex: options.branchIndex,
      output,
      traces,
      usage
    }

    return branchResult
  })

const appendBranchEvidence = <O extends Schema.Struct.Fields>(branches: ReadonlyArray<BranchResult<O>>) =>
  Effect.forEach(
    branches,
    (branch) =>
      Effect.zipRight(
        Effect.forEach(branch.traces, Trace.append, { discard: true }),
        Effect.gen(function*() {
          const usageEnabled = yield* FiberRef.get(Trace.UsageEnabledRef)

          return yield* Effect.if(usageEnabled, {
            onTrue: () =>
              FiberRef.update(
                Trace.UsageRef,
                (usage) =>
                  new UsageTotals({
                    inputTokens: usage.inputTokens + branch.usage.inputTokens,
                    outputTokens: usage.outputTokens + branch.usage.outputTokens,
                    callCount: usage.callCount + branch.usage.callCount,
                    cachedCount: usage.cachedCount + branch.usage.cachedCount
                  })
              ),
            onFalse: () => Effect.void
          })
        })
      ),
    { discard: true }
  )

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
          parallelExecutionError({
            moduleName: options.moduleName,
            failurePolicy: "fail-fast",
            failures: Arr.of(
              branchFailure({
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
            branchFailure({
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
          parallelExecutionError({
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
export const makeParallelForward = <
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

      yield* appendBranchEvidence(branches)

      return {
        [PARALLEL_OUTPUTS_FIELD]: Arr.map(branches, (branch) => branch.output)
      }
    }).pipe(Effect.mapError((error): AiError.AiError | DspError => error))
  )
