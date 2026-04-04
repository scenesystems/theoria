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
 * Fiber-local trace entry storage. Populated by `append` when tracing is
 * enabled. Scoped via `Effect.locally` for nested isolation.
 *
 * @since 0.1.0
 * @category refs
 */
export const TraceRef: FiberRef.FiberRef<ReadonlyArray<Entry>> = FiberRef.unsafeMake<ReadonlyArray<Entry>>([])

/**
 * Opt-in marker for trace collection. Set to `true` by `withTracing` — modules
 * only append entries when this ref is active.
 *
 * @since 0.1.0
 * @category refs
 */
export const TraceEnabledRef: FiberRef.FiberRef<boolean> = FiberRef.unsafeMake(false)

/**
 * Fiber-local cumulative usage totals. Updated by `appendUsage` when tracking
 * is enabled.
 *
 * @since 0.1.0
 * @category refs
 */
export const UsageRef: FiberRef.FiberRef<Usage> = FiberRef.unsafeMake(emptyUsage)

/**
 * Opt-in marker for usage tracking. Set to `true` by `withUsageTracking`.
 *
 * @since 0.1.0
 * @category refs
 */
export const UsageEnabledRef: FiberRef.FiberRef<boolean> = FiberRef.unsafeMake(false)
