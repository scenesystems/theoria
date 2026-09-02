/**
 * Defines the expected failures returned by public DSP operations.
 *
 * @remarks
 * Individual operations expose focused tagged errors for `Effect.catchTag`.
 * `DspError` is the schema union for persistence or transport boundaries that
 * accept every package-owned error.
 *
 * @since 0.1.0
 */

export * from "./metric.js"

export * from "./module.js"

export * from "./optimizer.js"

export * from "./save-load.js"

export * from "./signature.js"

export * from "./trace.js"

export * from "./union.js"
