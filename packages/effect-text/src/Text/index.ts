/**
 * Compiles raw text into measured handles, then lays out lines, ranges,
 * cursors, summaries, or streams without remeasuring.
 *
 * @remarks
 * Preparation is effectful and requires segmentation, measurement-cache, and
 * engine-profile services. Once preparation succeeds, layout operations are
 * pure and the richer handle returned by `prepareWithSegments` supports line
 * materialization and incremental traversal.
 *
 * @since 0.1.0
 * @module
 */
export { PreparedText, PreparedTextWithSegments, TextStability } from "./model.js"

/**
 * Decoders for prepare inputs and unit-consistent layout geometry.
 *
 * @since 0.1.0
 */
export * from "./schema.js"

/**
 * Effectful compilation of raw input into prepared text.
 *
 * @since 0.1.0
 */
export * from "./constructors.js"

/**
 * Pure line materialization, summaries, cursors, and streams.
 *
 * @since 0.1.0
 */
export * from "./layout.js"

/**
 * Deterministic and browser-backed live layers.
 *
 * @since 0.1.0
 */
export * from "./layers.js"
