/**
 * BootstrapFewShot runtime state — iteration counters, collected demos, and
 * scoring accumulators.
 *
 * @since 0.1.0
 * @internal
 */
import { Data } from "effect"
import type { Option } from "effect/Option"
import type { Demo } from "../../../Example/index.js"

export const DEFAULT_BOOTSTRAP_THRESHOLD = 1

export const DEFAULT_BOOTSTRAP_FALLBACK_DEMO_COUNT = 3

export class ExampleEvaluation extends Data.Class<{
  readonly demo: Option<Demo>
  readonly traceCount: number
  readonly accepted: boolean
  readonly score: number
}> {}

export class RoundEvaluation extends Data.Class<{
  readonly acceptedDemos: ReadonlyArray<Demo>
  readonly traceCount: number
  readonly acceptedCount: number
  readonly rejectedCount: number
  readonly evaluatedCount: number
  readonly scoreSum: number
  readonly bestScoreSeen: boolean
  readonly bestScore: number
}> {}

export class DemoMerge extends Data.Class<{
  readonly demos: ReadonlyArray<Demo>
  readonly added: number
}> {}

export class BootstrapState extends Data.Class<{
  readonly round: number
  readonly roundsAttempted: number
  readonly demos: ReadonlyArray<Demo>
  readonly totalTraces: number
  readonly acceptedTraces: number
  readonly rejectedTraces: number
  readonly evaluatedExamples: number
  readonly scoreSum: number
  readonly bestScoreSeen: boolean
  readonly bestScore: number
  readonly fallbackUsed: boolean
  readonly continue: boolean
}> {}
