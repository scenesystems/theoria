/**
 * Projectors and helpers for the implementation-strategy coding surface.
 *
 * @since 0.2.0
 */
import { Array as Arr } from "effect"
import { Option } from "effect"

import type { OpenAgentTraceRecord } from "../../schema.js"
import {
  type CodingPromptSurface,
  type CodingPromptSurfaceProjection,
  projectCodingPromptCase
} from "../promptSurface.js"
import type { CodingPromptCase, CodingPromptDatasetSplit } from "../schema.js"
import { stableUniqueStrings } from "../shared.js"
import type { Input as InputShape, Output as OutputShape } from "./schema.js"

const bulletList = (values: ReadonlyArray<string>): string => Arr.join(Arr.map(values, (value) => `- ${value}`), "\n")

const filesFromProjection = (options: {
  readonly files: ReadonlyArray<string>
  readonly fileTouches: ReadonlyArray<string>
}): ReadonlyArray<string> => stableUniqueStrings(Arr.appendAll(options.files, options.fileTouches))

/**
 * Canonical surface identifier for implementation-strategy optimization.
 *
 * @since 0.2.0
 * @category constants
 */
export const surfaceId = "implementation-strategy"

/**
 * Canonical input constructor for the implementation-strategy surface.
 *
 * @since 0.2.0
 * @category constructors
 */
export const Input = {
  of: (options: {
    readonly task: string
    readonly constraints: ReadonlyArray<string>
    readonly files: ReadonlyArray<string>
    readonly rejectedMoves: ReadonlyArray<string>
  }): InputShape => ({
    task: options.task,
    constraints: bulletList(options.constraints),
    files: bulletList(options.files),
    rejectedMoves: bulletList(options.rejectedMoves)
  })
}

/**
 * Canonical output constructor for the implementation-strategy surface.
 *
 * @since 0.2.0
 * @category constructors
 */
export const Output = {
  of: (strategy: string): OutputShape => ({ strategy })
}

/**
 * Builds implementation-strategy inputs from shared coding projections.
 *
 * @since 0.2.0
 * @category constructors
 */
export const inputFromProjection = (
  projection: CodingPromptSurfaceProjection
): InputShape =>
  Input.of({
    task: projection.task.prompt,
    constraints: projection.task.constraints,
    files: filesFromProjection({ files: projection.task.files, fileTouches: projection.evidence.fileTouches }),
    rejectedMoves: projection.evidence.failureSignals
  })

/**
 * Recomputes canonical implementation-strategy input fields from a prompt case.
 *
 * @since 0.2.0
 * @category constructors
 */
export const inputFromPromptCase = (
  promptCase: CodingPromptCase
): InputShape =>
  Input.of({
    task: promptCase.task.prompt,
    constraints: promptCase.task.constraints,
    files: filesFromProjection({ files: promptCase.task.files, fileTouches: promptCase.evidence.fileTouches }),
    rejectedMoves: promptCase.evidence.failureSignals
  })

/**
 * Canonical prompt-surface leaf for implementation-strategy optimization.
 *
 * @since 0.2.0
 * @category models
 */
export const promptSurface: CodingPromptSurface = {
  surfaceId,
  buildInput: inputFromProjection
}

/**
 * Projects one normalized coding trace into an implementation-strategy case.
 *
 * @since 0.2.0
 * @category constructors
 */
export const projectCase = (options: {
  readonly record: OpenAgentTraceRecord
  readonly split: CodingPromptDatasetSplit
  readonly expectedOutput?: OutputShape
}): CodingPromptCase =>
  Option.fromNullable(options.expectedOutput).pipe(
    Option.match({
      onNone: () =>
        projectCodingPromptCase({
          record: options.record,
          split: options.split,
          surface: promptSurface
        }),
      onSome: (expectedOutput) =>
        projectCodingPromptCase({
          record: options.record,
          split: options.split,
          surface: promptSurface,
          expectedOutput
        })
    })
  )
