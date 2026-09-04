/**
 * Defines executable language-model programs with mutable, learnable parameters.
 *
 * @remarks
 * Leaf modules decode signature inputs and outputs around model calls. Wrapper
 * modules change reasoning, selection, or refinement behavior, while composition
 * validates data flow between child modules. Discovery and persistence operate
 * on the same module identities and parameter references.
 *
 * @since 0.1.0
 * @module
 */

export * from "./model.js"

export * from "./predict/index.js"

export * from "./chainOfThought/index.js"

export * from "./react/index.js"

export * from "./bestOfN/index.js"

export * from "./refine/index.js"

export * from "./compose/index.js"

export * from "./discovery/index.js"

export * from "./save-load.js"
