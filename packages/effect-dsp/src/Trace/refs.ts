/**
 * Fiber-local storage used by trace and usage scopes.
 *
 * @since 0.1.0
 */
import { FiberRef } from "effect"
import type { Usage } from "../contracts/Usage.js"
import { emptyUsage } from "../contracts/Usage.js"
import type { Entry } from "./model.js"

/**
 * Holds entries visible to the current tracing scope.
 *
 * @remarks
 * The default is an empty array. {@link withTracing} installs a fresh value for
 * an outer scope and shares the active value with nested scopes.
 *
 * @since 0.1.0
 * @category refs
 */
export const TraceRef: FiberRef.FiberRef<ReadonlyArray<Entry>> = FiberRef.unsafeMake<ReadonlyArray<Entry>>([])

/**
 * Indicates whether {@link append} records an entry in the current fiber.
 *
 * @since 0.1.0
 * @category refs
 */
export const TraceEnabledRef: FiberRef.FiberRef<boolean> = FiberRef.unsafeMake(false)

/**
 * Holds cumulative model usage visible to the current tracking scope.
 *
 * @remarks
 * The default is {@link emptyUsage}.
 *
 * @since 0.1.0
 * @category refs
 */
export const UsageRef: FiberRef.FiberRef<Usage> = FiberRef.unsafeMake(emptyUsage)

/**
 * Indicates whether {@link appendUsage} accumulates a sample in the current fiber.
 *
 * @since 0.1.0
 * @category refs
 */
export const UsageEnabledRef: FiberRef.FiberRef<boolean> = FiberRef.unsafeMake(false)
