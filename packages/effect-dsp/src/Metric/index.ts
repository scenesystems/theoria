/**
 * Scores predicted records against expected records during evaluation and optimization.
 *
 * @remarks
 * Metrics return normalized score records and may carry their own Effect error
 * and service channels. Composition controls weighting and failure behavior.
 *
 * @since 0.1.0
 * @module
 */

export * from "./model.js"

export * from "./constructors.js"

export * from "./builtins.js"

export * from "./compose.js"
