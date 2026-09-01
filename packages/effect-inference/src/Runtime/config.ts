/**
 * Effect-native descriptor decoding helpers for configuration boundaries.
 *
 * @since 0.1.0
 */
import { Effect, Schema } from "effect"

import { type DesiredRuntimeDescriptor, DesiredRuntimeDescriptorSchema } from "../contracts/DesiredRuntimeDescriptor.js"
import { type ResolvedRouteDescriptor, ResolvedRouteDescriptorSchema } from "../contracts/ResolvedRouteDescriptor.js"
import {
  type ResolvedRuntimeDescriptor,
  ResolvedRuntimeDescriptorSchema
} from "../contracts/ResolvedRuntimeDescriptor.js"
import { type RuntimeEvidence, RuntimeEvidenceSchema } from "../contracts/RuntimeEvidence.js"
import { InvalidRuntimeConfig } from "../Errors/Config.js"

const makeInvalidRuntimeConfig = (reason: string): InvalidRuntimeConfig => new InvalidRuntimeConfig({ reason })

/**
 * Validates untrusted input at the desired-descriptor boundary. Every Effect
 * Schema parse failure is mapped to `InvalidRuntimeConfig`; its `reason`
 * contains the rendered parse issue.
 *
 * @since 0.1.0
 * @category decoders
 */
export const decodeDesiredRuntimeDescriptor = (
  input: unknown
): Effect.Effect<DesiredRuntimeDescriptor, InvalidRuntimeConfig> =>
  Schema.decodeUnknown(DesiredRuntimeDescriptorSchema)(input).pipe(
    Effect.mapError((error) => makeInvalidRuntimeConfig(String(error)))
  )

/**
 * Validates untrusted pre-execution route provenance, including the exact
 * `resolved-route/v1` schema version. Parse failures become
 * `InvalidRuntimeConfig` with the rendered issue in `reason`.
 *
 * @since 0.1.0
 * @category decoders
 */
export const decodeResolvedRouteDescriptor = (
  input: unknown
): Effect.Effect<ResolvedRouteDescriptor, InvalidRuntimeConfig> =>
  Schema.decodeUnknown(ResolvedRouteDescriptorSchema)(input).pipe(
    Effect.mapError((error) => makeInvalidRuntimeConfig(String(error)))
  )

/**
 * Validates untrusted post-execution response evidence. This only decodes the
 * supplied record; it does not establish that a provider produced it. Parse
 * failures become `InvalidRuntimeConfig`.
 *
 * @since 0.1.0
 * @category decoders
 */
export const decodeResolvedRuntimeDescriptor = (
  input: unknown
): Effect.Effect<ResolvedRuntimeDescriptor, InvalidRuntimeConfig> =>
  Schema.decodeUnknown(ResolvedRuntimeDescriptorSchema)(input).pipe(
    Effect.mapError((error) => makeInvalidRuntimeConfig(String(error)))
  )

/**
 * Validates all requested, resolved-route, capability, and post-execution
 * sections as one serializable evidence record. It does not contact a provider
 * or verify the claims. Parse failures become `InvalidRuntimeConfig`.
 *
 * @since 0.1.0
 * @category decoders
 */
export const decodeRuntimeEvidence = (
  input: unknown
): Effect.Effect<RuntimeEvidence, InvalidRuntimeConfig> =>
  Schema.decodeUnknown(RuntimeEvidenceSchema)(input).pipe(
    Effect.mapError((error) => makeInvalidRuntimeConfig(String(error)))
  )
