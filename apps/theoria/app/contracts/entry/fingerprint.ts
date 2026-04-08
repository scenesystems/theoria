import { durableFingerprint } from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const DurableFingerprintPattern = /^blake3-256:[A-Za-z0-9_-]{43}$/u

export const DurableFingerprint = Schema.String.pipe(Schema.pattern(DurableFingerprintPattern))

export type DurableFingerprint = typeof DurableFingerprint.Type

const decodeDurableFingerprint = Schema.decodeSync(DurableFingerprint)

export const fingerprintOf = (value: unknown): Effect.Effect<DurableFingerprint, never, never> =>
  durableFingerprint(value).pipe(Effect.orDie, Effect.map(decodeDurableFingerprint))
