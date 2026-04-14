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

/**
 * Decodes unknown input into a desired runtime descriptor with a typed package
 * error on failure.
 *
 * @since 0.1.0
 * @category decoders
 */
export const decodeDesiredRuntimeDescriptor = (
  input: unknown
): Effect.Effect<DesiredRuntimeDescriptor, InvalidRuntimeConfig> =>
  Schema.decodeUnknown(DesiredRuntimeDescriptorSchema)(input).pipe(
    Effect.mapError((error) => InvalidRuntimeConfig.make({ reason: String(error) }))
  )

/**
 * Decodes unknown input into a resolved-route descriptor with a typed package
 * error on failure.
 *
 * @since 0.1.0
 * @category decoders
 */
export const decodeResolvedRouteDescriptor = (
  input: unknown
): Effect.Effect<ResolvedRouteDescriptor, InvalidRuntimeConfig> =>
  Schema.decodeUnknown(ResolvedRouteDescriptorSchema)(input).pipe(
    Effect.mapError((error) => InvalidRuntimeConfig.make({ reason: String(error) }))
  )

/**
 * Decodes unknown input into a resolved-runtime descriptor with a typed
 * package error on failure.
 *
 * @since 0.1.0
 * @category decoders
 */
export const decodeResolvedRuntimeDescriptor = (
  input: unknown
): Effect.Effect<ResolvedRuntimeDescriptor, InvalidRuntimeConfig> =>
  Schema.decodeUnknown(ResolvedRuntimeDescriptorSchema)(input).pipe(
    Effect.mapError((error) => InvalidRuntimeConfig.make({ reason: String(error) }))
  )

/**
 * Decodes unknown input into replay-safe runtime evidence with a typed package
 * error on failure.
 *
 * @since 0.1.0
 * @category decoders
 */
export const decodeRuntimeEvidence = (
  input: unknown
): Effect.Effect<RuntimeEvidence, InvalidRuntimeConfig> =>
  Schema.decodeUnknown(RuntimeEvidenceSchema)(input).pipe(
    Effect.mapError((error) => InvalidRuntimeConfig.make({ reason: String(error) }))
  )
