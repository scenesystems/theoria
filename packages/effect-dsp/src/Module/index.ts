/**
 * Learnable LLM program modules — constructors for `predict`, `chainOfThought`,
 * `programOfThought`, `multiChainComparison`, `parallel`, `react`, `bestOfN`,
 * `refine`, and `compose` modules, plus discovery and parameter persistence.
 *
 * @since 0.1.0
 */

import { PredictPolicy as PredictPolicyConstructor } from "./predict/index.js"
import type { PredictPolicy as PredictPolicyModel } from "./predict/index.js"

/**
 * Core `Module` class and `SavedState` envelope for parameter persistence.
 *
 * @since 0.1.0
 */
export * from "./model.js"

/**
 * The `predict` constructor and the original parse-policy value surface.
 *
 * @since 0.1.0
 */
export {
  /**
   * Backoff multiplier used by the default parse-retry schedule.
   *
   * @since 0.1.0
   */
  DEFAULT_PARSE_BACKOFF_FACTOR,
  /**
   * Initial delay used by the default parse-retry schedule.
   *
   * @since 0.1.0
   */
  DEFAULT_PARSE_INITIAL_DELAY,
  /**
   * Maximum retry count used by the default parse-retry schedule.
   *
   * @since 0.1.0
   */
  DEFAULT_PARSE_MAX_RETRIES,
  /**
   * Canonical default predict policy.
   *
   * @since 0.1.0
   */
  DEFAULT_PREDICT_POLICY,
  /**
   * Default feedback template injected on parse retries.
   *
   * @since 0.1.0
   */
  defaultParseFeedbackTemplate,
  /**
   * Default parse-retry schedule factory.
   *
   * @since 0.1.0
   */
  defaultParseRetrySchedule,
  /**
   * Leaf predictor constructor for schema-validated language-model calls.
   *
   * @since 0.1.0
   */
  predict
} from "./predict/index.js"

/**
 * Predict constructor options and the original parse-policy type surface.
 *
 * @since 0.1.0
 */
export type {
  /**
   * Feedback template shape injected on parse retries.
   *
   * @since 0.1.0
   */
  ParseFeedbackTemplate,
  /**
   * Predict parse-policy model governing retry behavior.
   *
   * @since 0.1.0
   */
  ParsePolicy,
  /**
   * Partial override surface for the predict parse policy.
   *
   * @since 0.1.0
   */
  ParsePolicyOverrides,
  /**
   * Factory shape for parse-retry schedules.
   *
   * @since 0.1.0
   */
  ParseRetryScheduleFactory,
  /**
   * Constructor options for one `predict` module.
   *
   * @since 0.1.0
   */
  PredictOptions,
  /**
   * Override surface accepted by the `PredictPolicy` constructor.
   *
   * @since 0.1.0
   */
  PredictPolicyOverrides
} from "./predict/index.js"

/**
 * Top-level policy type for a predict module governing parse retry behavior.
 *
 * @since 0.1.0
 * @category models
 */
export type PredictPolicy = PredictPolicyModel

/**
 * Predict-policy constructor namespace introduced after the original type-only
 * `PredictPolicy` surface shipped.
 *
 * @since 0.2.0
 * @category constructors
 */
export const PredictPolicy = PredictPolicyConstructor

/**
 * The `chainOfThought` constructor — wraps a signature with a mandatory
 * `reasoning` output field.
 *
 * @since 0.1.0
 */
export * from "./chainOfThought/index.js"

/**
 * The `programOfThought` constructor — generates executable code, runs it
 * through an injected interpreter boundary, repairs failures, and projects
 * the final answer back onto the original signature.
 *
 * @since 0.2.0
 */
export * from "./programOfThought/index.js"

/**
 * The `multiChainComparison` constructor — runs multiple reasoning chains,
 * compares them in a final verdict pass, and projects the best answer back
 * onto the original signature.
 *
 * @since 0.2.0
 */
export * from "./multiChainComparison/index.js"

/**
 * The `parallel` constructor — fans out a wrapped module over ordered batch
 * inputs with explicit concurrency and failure-policy control.
 *
 * @since 0.2.0
 */
export * from "./parallel/index.js"

/**
 * The `react` constructor — creates a module that interleaves tool calls
 * and reasoning across multiple iterations.
 *
 * @since 0.1.0
 */
export * from "./react/index.js"

/**
 * The `bestOfN` constructor — runs a module N times with distinct rollout
 * identities and returns the highest-scoring candidate.
 *
 * @since 0.1.0
 */
export * from "./bestOfN/index.js"

/**
 * The `refine` constructor — iteratively improves module output by feeding
 * reward feedback back into the prompt.
 *
 * @since 0.1.0
 */
export * from "./refine/index.js"

/**
 * The `compose` constructor — builds multi-module pipelines with validated
 * composition graphs.
 *
 * @since 0.1.0
 */
export * from "./compose/index.js"

/**
 * Module discovery via FiberRef — registers modules during execution for
 * optimizer graph construction.
 *
 * @since 0.1.0
 */
export * from "./discovery/index.js"

/**
 * Parameter persistence — `save` and `load` serialize module state via
 * Schema envelopes.
 *
 * @since 0.1.0
 */
export * from "./save-load.js"
