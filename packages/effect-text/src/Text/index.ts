/**
 * Provisional text preparation, prepared handles, pure layout, and live runtime layers.
 *
 * @since 0.1.0
 */
export {
  /**
   * Prepared text handle returned by `Text.prepare`.
   *
   * @since 0.1.0
   * @category models
   */
  PreparedText,
  /**
   * Stability lane for the Text namespace.
   *
   * @since 0.1.0
   * @category stability
   */
  TextStability
} from "./model.js"

/**
 * Public schemas and schema-derived types for preparation and layout.
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
