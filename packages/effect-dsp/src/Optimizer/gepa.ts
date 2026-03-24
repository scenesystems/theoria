/**
 * GEPA — Guided Evolutionary Prompt Adaptation via teacher-student debate and
 * evolutionary crossover.
 *
 * @since 0.0.0
 */
export {
  /**
   * Run the GEPA optimizer and return the optimized module with tuned
   * instructions.
   *
   * @since 0.0.0
   * @category constructors
   */
  gepa,
  /**
   * Callback sink for streaming GEPA progress events during optimization.
   *
   * @since 0.0.0
   * @category type-level
   */
  type GEPAEventSink,
  /**
   * Configuration for GEPA optimization: module, examples, metrics, population
   * size, and generation count.
   *
   * @since 0.0.0
   * @category models
   */
  type GEPAOptions,
  /**
   * Run GEPA with a user-supplied event sink for real-time progress streaming.
   *
   * @since 0.0.0
   * @category constructors
   */
  gepaWithEvents,
  /**
   * No-op event sink that discards all GEPA events.
   *
   * @since 0.0.0
   * @category constants
   */
  noGEPAEvents
} from "../optimizers/GEPA/index.js"
