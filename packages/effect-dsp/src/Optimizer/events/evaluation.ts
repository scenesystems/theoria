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
   * @category re-exports
   */
  EvaluationEvent,
  /**
   * Schema union for evaluation lifecycle events — `ExampleStarted`,
   * `ExampleCompleted`, `ExampleFailed`, `EvaluationCompleted`.
   *
   * @since 0.1.0
   * @category re-exports
   */
  EvaluationEventSchema,
  /**
   * Discriminated union type for evaluation events.
   *
   * @since 0.1.0
   * @category re-exports
   */
  type EvaluationEventType
} from "../../Evaluate/events.js"
