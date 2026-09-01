/**
 * Cross-domain error union.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { EvaluationFailed, MetricError } from "./metric.js"
import { CompositionError, ParseOutputError } from "./module.js"
import { AllTrialsFailed, BootstrapFailed, InstructionProposalFailed, MergeRejected } from "./optimizer.js"
import { SaveLoadError } from "./save-load.js"
import { SignatureError } from "./signature.js"
import { TraceError } from "./trace.js"

/**
 * Union schema covering the error classes exported from this module. It does
 * not include dependency, platform, provider, parse, or user callback errors
 * that other APIs may expose in their Effect error channels.
 *
 * @since 0.1.0
 * @category errors
 */
export const DspError = Schema.Union(
  SignatureError,
  ParseOutputError,
  CompositionError,
  BootstrapFailed,
  InstructionProposalFailed,
  AllTrialsFailed,
  MergeRejected,
  MetricError,
  EvaluationFailed,
  TraceError,
  SaveLoadError
)

/**
 * Errors that callers can handle uniformly by `_tag` across signatures,
 * modules, optimizers, metrics, evaluation, tracing, and persistence. Like the
 * schema, this excludes provider, platform, dependency, and callback failures.
 *
 * @since 0.1.0
 * @category errors
 */
export type DspError = Schema.Schema.Type<typeof DspError>
