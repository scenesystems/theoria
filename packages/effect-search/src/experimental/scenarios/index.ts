/**
 * Defines fixed configuration decoders and search spaces for sampler and study tests.
 *
 * @remarks
 * Sampling ranges belong to the spaces. The exported configuration schemas validate
 * field shape and literal choices but do not add numeric sampling bounds as refinements.
 * These declarations may change without a major-version release.
 *
 * @since 0.1.0
 * @module
 */
export * from "./conditionalLinearTree.js"
export * from "./mixedOptimizer.js"
export * from "./promptCategorical.js"
export * from "./randomTraining.js"
export * from "./slot.js"
