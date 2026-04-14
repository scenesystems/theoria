/**
 * Associated-data validation helpers for AEAD boundaries.
 *
 * Associated data is authenticated but not encrypted. The public API keeps the
 * surface as `Uint8Array`, while this helper preserves a typed runtime failure
 * when callers cross the boundary with malformed values.
 *
 * @internal
 */
import { Effect, Option, Schema } from "effect"
import { InvalidAssociatedData } from "../schemas/errors.js"
import type { SealAlgorithm } from "../schemas/SealAlgorithm.js"

type SealAlgorithmType = typeof SealAlgorithm.Type

const AssociatedDataSchema = Schema.Uint8ArrayFromSelf.pipe(
  Schema.filter((value) => value.byteLength > 0 || "associated data must be non-empty when provided")
)

/**
 * Validate optional associated data at the package boundary.
 *
 * @internal
 */
export const validateAssociatedData = (
  algorithm: SealAlgorithmType,
  associatedData: Option.Option<Uint8Array>
): Effect.Effect<Option.Option<Uint8Array>, InvalidAssociatedData> =>
  Option.match(associatedData, {
    onNone: () => Effect.succeed(Option.none()),
    onSome: (value) =>
      Schema.decodeUnknown(AssociatedDataSchema)(value).pipe(
        Effect.map(Option.some),
        Effect.mapError(
          () =>
            new InvalidAssociatedData({
              algorithm,
              reason: "associated data must be a non-empty Uint8Array when provided"
            })
        )
      )
  })
