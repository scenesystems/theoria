/**
 * Internal capability validation helpers for live runtime resolution.
 *
 * @since 0.1.0
 */
import { Boolean, Effect, Inspectable, Match, Number, Option, String } from "effect"

import type { Capabilities, Requirements } from "../Capabilities.js"
import { CapabilityMismatch } from "../InferenceError.js"

const validateBooleanRequirement = (
  capability: string,
  required: Option.Option<boolean>,
  supported: boolean
): Effect.Effect<void, CapabilityMismatch> =>
  required.pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (required) =>
        Effect.if(Boolean.and(required, Boolean.not(supported)), {
          onTrue: () =>
            Effect.fail(
              new CapabilityMismatch({
                capability,
                reason: String.concat("resolved runtime does not support ", capability)
              })
            ),
          onFalse: () => Effect.void
        })
    })
  )

const validateStructuredOutputRequirement = (
  required: Option.Option<Capabilities["structuredOutput"]>,
  supported: Capabilities["structuredOutput"]
): Effect.Effect<void, CapabilityMismatch> =>
  required.pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (required) =>
        Effect.if(
          Match.value(required).pipe(
            Match.when("none", () => true),
            Match.when("best-effort", () => Boolean.not(String.Equivalence(supported, "none"))),
            Match.when("strict", () => String.Equivalence(supported, "strict")),
            Match.exhaustive
          ),
          {
            onTrue: () => Effect.void,
            onFalse: () =>
              Effect.fail(
                new CapabilityMismatch({
                  capability: "structuredOutput",
                  reason: String.concat(
                    String.concat("resolved runtime only supports ", supported),
                    " structured output"
                  )
                })
              )
          }
        )
    })
  )

const validateMinimumContextTokens = (
  required: Option.Option<number>,
  supported: Option.Option<number>
): Effect.Effect<void, CapabilityMismatch> =>
  required.pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (required) =>
        supported.pipe(
          Option.match({
            onNone: () =>
              Effect.fail(
                new CapabilityMismatch({
                  capability: "minimumContextTokens",
                  reason: "resolved runtime does not declare maxContextTokens"
                })
              ),
            onSome: (supported) =>
              Effect.if(Number.lessThan(supported, required), {
                onTrue: () =>
                  Effect.fail(
                    new CapabilityMismatch({
                      capability: "minimumContextTokens",
                      reason: String.concat(
                        String.concat("resolved runtime declares ", Inspectable.toStringUnknown(supported)),
                        " max context tokens"
                      )
                    })
                  ),
                onFalse: () => Effect.void
              })
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
  requirements: Option.Option<Requirements>,
  capabilities: Capabilities
): Effect.Effect<void, CapabilityMismatch> =>
  requirements.pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (resolvedRequirements) =>
        Effect.gen(function*() {
          yield* validateBooleanRequirement(
            "textGeneration",
            Option.fromNullable(resolvedRequirements.textGeneration),
            capabilities.textGeneration
          )
          yield* validateBooleanRequirement(
            "embeddings",
            Option.fromNullable(resolvedRequirements.embeddings),
            capabilities.embeddings
          )
          yield* validateBooleanRequirement(
            "streaming",
            Option.fromNullable(resolvedRequirements.streaming),
            capabilities.streaming
          )
          yield* validateBooleanRequirement(
            "toolCalling",
            Option.fromNullable(resolvedRequirements.toolCalling),
            capabilities.toolCalling
          )
          yield* validateBooleanRequirement(
            "usageReporting",
            Option.fromNullable(resolvedRequirements.usageReporting),
            capabilities.usageReporting
          )
          yield* validateBooleanRequirement(
            "multimodalInput",
            Option.fromNullable(resolvedRequirements.multimodalInput),
            capabilities.multimodalInput
          )
          yield* validateStructuredOutputRequirement(
            Option.fromNullable(resolvedRequirements.structuredOutput),
            capabilities.structuredOutput
          )
          yield* validateMinimumContextTokens(
            Option.fromNullable(resolvedRequirements.minimumContextTokens),
            Option.fromNullable(capabilities.maxContextTokens)
          )
        })
    })
  )
