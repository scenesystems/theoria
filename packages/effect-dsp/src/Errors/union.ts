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
 * Union schema covering all effect-dsp error types. Useful for top-level error
 * handling when you want to catch any library error.
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
 * Discriminated union type of all effect-dsp errors, extracted from
 * {@link DspError} schema.
 *
 * @since 0.1.0
 * @category errors
 */
export type DspError = Schema.Schema.Type<typeof DspError>
