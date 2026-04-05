/**
 * Internal capability validation helpers for live runtime resolution.
 *
 * @since 0.1.0
 */
import { Effect, Match, Option } from "effect"

import type { CapabilityRequirements } from "../contracts/CapabilityRequirements.js"
import type { RuntimeCapabilities } from "../contracts/RuntimeCapabilities.js"
import { CapabilityMismatch } from "../Errors/Capability.js"

const structuredOutputRankNone: 0 = 0
const structuredOutputRankBestEffort: 1 = 1
const structuredOutputRankStrict: 2 = 2

const validateBooleanRequirement = (options: {
  readonly capability: string
  readonly required: Option.Option<boolean>
  readonly supported: boolean
}): Effect.Effect<void, CapabilityMismatch> =>
  options.required.pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (required) =>
        required && !options.supported
          ? Effect.fail(
            new CapabilityMismatch({
              capability: options.capability,
              reason: `resolved runtime does not support ${options.capability}`
            })
          )
          : Effect.void
    })
  )

const structuredOutputRank = (
  mode: RuntimeCapabilities["structuredOutput"]
): 0 | 1 | 2 =>
  Match.value(mode).pipe(
    Match.when("none", () => structuredOutputRankNone),
    Match.when("best-effort", () => structuredOutputRankBestEffort),
    Match.when("strict", () => structuredOutputRankStrict),
    Match.exhaustive
  )

const validateStructuredOutputRequirement = (options: {
  readonly required: Option.Option<RuntimeCapabilities["structuredOutput"]>
  readonly supported: RuntimeCapabilities["structuredOutput"]
}): Effect.Effect<void, CapabilityMismatch> =>
  options.required.pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (required) =>
        structuredOutputRank(options.supported) < structuredOutputRank(required)
          ? Effect.fail(
            new CapabilityMismatch({
              capability: "structuredOutput",
              reason: `resolved runtime only supports ${options.supported} structured output`
            })
          )
          : Effect.void
    })
  )

const validateMinimumContextTokens = (options: {
  readonly required: Option.Option<number>
  readonly supported: Option.Option<number>
}): Effect.Effect<void, CapabilityMismatch> =>
  options.required.pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (required) =>
        options.supported.pipe(
          Option.match({
            onNone: () =>
              Effect.fail(
                new CapabilityMismatch({
                  capability: "minimumContextTokens",
                  reason: "resolved runtime does not declare maxContextTokens"
                })
              ),
            onSome: (supported) =>
              supported < required
                ? Effect.fail(
                  new CapabilityMismatch({
                    capability: "minimumContextTokens",
                    reason: `resolved runtime declares ${supported} max context tokens`
                  })
                )
                : Effect.void
          })
        )
    })
  )

/**
 * Validates caller-declared capability requirements against conservative
 * resolved capability truth.
 *
 * @since 0.1.0
 */
export const ensureCapabilityRequirements = (
  requirements: Option.Option<CapabilityRequirements>,
  capabilities: RuntimeCapabilities
): Effect.Effect<void, CapabilityMismatch> =>
  requirements.pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (resolvedRequirements) =>
        Effect.gen(function*() {
          yield* validateBooleanRequirement({
            capability: "textGeneration",
            required: Option.fromNullable(resolvedRequirements.textGeneration),
            supported: capabilities.textGeneration
          })
          yield* validateBooleanRequirement({
            capability: "embeddings",
            required: Option.fromNullable(resolvedRequirements.embeddings),
            supported: capabilities.embeddings
          })
          yield* validateBooleanRequirement({
            capability: "streaming",
            required: Option.fromNullable(resolvedRequirements.streaming),
            supported: capabilities.streaming
          })
          yield* validateBooleanRequirement({
            capability: "toolCalling",
            required: Option.fromNullable(resolvedRequirements.toolCalling),
            supported: capabilities.toolCalling
          })
          yield* validateBooleanRequirement({
            capability: "usageReporting",
            required: Option.fromNullable(resolvedRequirements.usageReporting),
            supported: capabilities.usageReporting
          })
          yield* validateBooleanRequirement({
            capability: "multimodalInput",
            required: Option.fromNullable(resolvedRequirements.multimodalInput),
            supported: capabilities.multimodalInput
          })
          yield* validateStructuredOutputRequirement({
            required: Option.fromNullable(resolvedRequirements.structuredOutput),
            supported: capabilities.structuredOutput
          })
          yield* validateMinimumContextTokens({
            required: Option.fromNullable(resolvedRequirements.minimumContextTokens),
            supported: Option.fromNullable(capabilities.maxContextTokens)
          })
        })
    })
  )
