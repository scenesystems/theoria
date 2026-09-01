/**
 * Trace and usage FiberRef ownership.
 *
 * @since 0.1.0
 */
import { FiberRef } from "effect"
import type { Usage } from "../contracts/Usage.js"
import { emptyUsage } from "../contracts/Usage.js"
import type { Entry } from "./model.js"

/**
 * Fiber-local trace entries used by {@link import("./append.js").append}.
 *
 * @since 0.1.0
 * @category refs
 */
export const TraceRef: FiberRef.FiberRef<ReadonlyArray<Entry>> = FiberRef.unsafeMake<ReadonlyArray<Entry>>([])

/**
 * Fiber-local flag read by trace append operations.
 *
 * @since 0.1.0
 * @category refs
 */
export const TraceEnabledRef: FiberRef.FiberRef<boolean> = FiberRef.unsafeMake(false)

/**
 * Fiber-local cumulative usage totals.
 *
 * @since 0.1.0
 * @category refs
 */
export const UsageRef: FiberRef.FiberRef<Usage> = FiberRef.unsafeMake(emptyUsage)

/**
 * Fiber-local flag read by usage append operations.
 *
 * @since 0.1.0
 * @category refs
 */
export const UsageEnabledRef: FiberRef.FiberRef<boolean> = FiberRef.unsafeMake(false)
