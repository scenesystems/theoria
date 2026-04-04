/**
 * Predict-forward execution model.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type { Option } from "effect"
import { Data } from "effect"
import type { FieldRecord as FieldRecordType } from "../../contracts/FieldValue.js"

/**
 * Runtime output bundle produced by the predict forward engine.
 *
 * @since 0.1.0
 * @internal
 */
export class ForwardExecution<A> extends Data.Class<{
  readonly output: A
  readonly traceOutput: FieldRecordType
  readonly promptText: string
  readonly rawResponse: string
  readonly inputTokens: Option.Option<number>
  readonly outputTokens: Option.Option<number>
}> {}
