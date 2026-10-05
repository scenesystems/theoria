/**
 * Decoded program output together with the evidence collected during invocation.
 * @since 1.0.0
 * @module
 */
import { Data } from "effect"
import type * as Trace from "./Trace.js"

/** A program result retaining its trace and aggregate native usage.
 * @since 1.0.0
 * @category models
 */
export class Prediction<O> extends Data.Class<{
  readonly output: O
  readonly trace: Trace.Program
  readonly usage: Trace.Usage
}> {}
