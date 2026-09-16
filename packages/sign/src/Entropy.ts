/**
 * Cryptographically secure entropy as an explicit Effect capability. Never use
 * Effect's seedable Random service for production keys or signing randomness.
 *
 * @since 0.5.0
 * @module
 */
import { randomBytes } from "@noble/hashes/utils.js"
import { Context, Effect, Inspectable, Layer, Match, Predicate, Schema, String as Str } from "effect"

/**
 * The cryptographic random source rejected a length or could not supply bytes.
 * Contains the requested length and diagnostic, never entropy or key material.
 * @since 0.5.0
 * @category errors
 */
export class GenerationFailed
  extends Schema.TaggedError<GenerationFailed>("@scenesystems/sign/Entropy/GenerationFailed")(
    "EntropyGenerationFailed",
    { length: Schema.Number, reason: Schema.String }
  )
{}

/**
 * Supplies fresh, caller-owned cryptographically secure bytes on every execution.
 * Implementations must honor the exact requested length or fail. Reproducible
 * replacements are appropriate only for tests, never production key material.
 * @since 0.5.0
 * @category services
 */
export class Entropy extends Context.Tag("@scenesystems/sign/Entropy")<Entropy, {
  readonly bytes: (length: number) => Effect.Effect<Uint8Array, GenerationFailed>
}>() {}

/**
 * Requests an explicit number of bytes from the supplied Entropy service.
 * The service is consulted when the Effect runs, not when it is constructed.
 * @since 0.5.0
 * @category generation
 */
export const bytes = (length: number): Effect.Effect<Uint8Array, GenerationFailed, Entropy> =>
  Effect.flatMap(Entropy, (source) => source.bytes(length))

/**
 * Uses the platform CSPRNG through Noble. Accepts integer lengths from 0 through
 * 65,536; missing crypto.getRandomValues and rejected lengths fail explicitly.
 * Provide this layer near the application's execution boundary.
 *
 * Explicit entropy governs generated keys and randomized signatures. Noble's
 * internal scalar blinding may independently consult its native CSPRNG; this
 * layer does not replace or disable those side-channel protections.
 * @since 0.5.0
 * @category layers
 */
export const layer: Layer.Layer<Entropy> = Layer.succeed(Entropy, {
  bytes: (length) =>
    Effect.try({
      try: () => randomBytes(length),
      catch: (cause) =>
        new GenerationFailed({
          length,
          reason: Match.value(cause).pipe(
            Match.when(Predicate.isError, ({ name, message }) => Str.concat(Str.concat(name, ": "), message)),
            Match.orElse(Inspectable.toStringUnknown)
          )
        })
    })
})
