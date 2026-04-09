/**
 * Parallel branch failure projection helpers.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { Match } from "effect"

import { ParallelBranchFailure, ParallelExecutionError } from "../../../Errors/index.js"

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

/**
 * Noun-owned failure construction for `Module.parallel`.
 *
 * @since 0.2.0
 * @category constructors
 * @internal
 */
export namespace ParallelFailure {
  export const branch = (options: {
    readonly branchIndex: number
    readonly branchModuleName: string
    readonly error: unknown
  }): ParallelBranchFailure =>
    ParallelBranchFailure.make({
      branchIndex: options.branchIndex,
      branchModuleName: options.branchModuleName,
      errorTag: errorTag(options.error),
      message: errorMessage(options.error)
    })
  export const execution = (options: {
    readonly moduleName: string
    readonly failurePolicy: ParallelExecutionError["failurePolicy"]
    readonly failures: ReadonlyArray<ParallelBranchFailure>
  }): ParallelExecutionError =>
    ParallelExecutionError.make({
      message: `Parallel execution failed under ${options.failurePolicy}.`,
      moduleName: options.moduleName,
      failurePolicy: options.failurePolicy,
      failures: options.failures
    })
}
