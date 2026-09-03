/**
 * Evaluation event contracts shared by Evaluate and Optimizer namespaces.
 *
 * @since 0.1.0
 */
export {
  /**
   * Tagged-enum constructors and `$match` helpers for evaluation lifecycle
   * events.
   *
   * @since 0.1.0
   * @category events
   */
  EvaluationEvent,
  /**
   * Schema union for evaluation lifecycle events — `ExampleStarted`,
   * `ExampleCompleted`, `ExampleFailed`, `EvaluationCompleted`.
   *
   * @since 0.1.0
   * @category events
   */
  EvaluationEventSchema,
  /**
   * Discriminated union type for evaluation events.
   *
   * @since 0.1.0
   * @category events
   */
  type EvaluationEventType
} from "../../Evaluate/events.js"
