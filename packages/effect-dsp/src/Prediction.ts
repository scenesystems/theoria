/**
 * Decoded program output together with the evidence collected during invocation.
 * @since 1.0.0
 * @module
 */
import { Data, Schema } from "effect"
import * as Trace from "./Trace.js"

/** A program result retaining its trace and aggregate native usage.
 * @since 1.0.0
 * @category models
 */
export class Prediction<O> extends Data.Class<{
  readonly output: O
  readonly trace: Trace.Program
  readonly usage: Trace.Usage
}> {}

/** Serializes prediction evidence using the caller's output codec.
 * @since 0.6.0
 * @category schemas
 */
export const schema = <O extends Schema.Constraint>(output: O) =>
  Schema.Struct({
    output,
    trace: Trace.Program,
    usage: Trace.Usage
  })
