/**
 * Evolves module instructions through reflective mutation and Pareto selection.
 *
 * @since 0.1.0
 */
export {
  /**
   * Evolves a module while discarding lifecycle events.
   *
   * @since 0.1.0
   * @category constructors
   */
  gepa,
  /**
   * Receives each lifecycle event before optimization advances.
   *
   * @since 0.1.0
   * @category type-level
   */
  type GEPAEventSink,
  /**
   * Configures candidate evaluation, reflective mutation, and merge attempts.
   *
   * @since 0.1.0
   * @category models
   */
  type GEPAOptions,
  /**
   * Evolves a module while emitting lifecycle events in execution order.
   *
   * @since 0.1.0
   * @category constructors
   */
  gepaWithEvents,
  /**
   * Discards lifecycle events without adding Effect channels.
   *
   * @since 0.1.0
   * @category constants
   */
  noGEPAEvents
} from "../optimizers/GEPA/index.js"
