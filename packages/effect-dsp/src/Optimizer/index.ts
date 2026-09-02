/**
 * Derives module instructions and demonstrations from examples and metric scores.
 *
 * @remarks
 * Built-in optimizers differ in how they collect demonstrations, propose
 * instructions, and search candidates. Their typed failures and lifecycle events
 * remain algorithm-specific. `effectSearchInterop` evaluates parameter choices
 * through an effect-search ask/tell study.
 *
 * @since 0.1.0
 */

export * from "./events/index.js"

export * from "./bootstrapFewShot.js"

export * from "./labeledFewShot.js"

export * from "./bootstrapRS.js"

export * from "./ensemble.js"

export * from "./miprov2.js"

export * from "./gepa.js"

export * from "./gepaStream.js"

export * from "./progress.js"

export { effectSearchInterop } from "../optimizers/effectSearchInterop/index.js"
