import { Effect, Match, Schema } from "effect"
import {
  FixtureKindSchema,
  FixtureManifestSchema,
  HashFixtureSchema,
  HmacHkdfFixtureSchema,
  JcsFixtureSchema,
  type FixtureKind,
  RuntimeParityFixtureSchema
} from "./fixture-schemas.js"

export const EXTERNAL_FIXTURE_ROOT = "test/fixtures/external"
export const PARITY_FIXTURE_ROOT = "test/fixtures/parity/generated"
export const MANIFEST_FILE = "sources.manifest.json"
export { FixtureKindSchema, FixtureManifestSchema }
export type { FixtureKind }

export const decodeUnknownJson = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))

export const validateFixtureByKind = (
  kind: FixtureKind,
  content: string
): Effect.Effect<void, unknown, never> =>
  Match.value(kind).pipe(
    Match.when("jcs", () => Schema.decodeUnknown(JcsFixtureSchema)(content).pipe(Effect.asVoid)),
    Match.when("hash", () => Schema.decodeUnknown(HashFixtureSchema)(content).pipe(Effect.asVoid)),
    Match.when("hmac-hkdf", () =>
      Schema.decodeUnknown(HmacHkdfFixtureSchema)(content).pipe(Effect.asVoid)),
    Match.when("parity-runtime", () =>
      Schema.decodeUnknown(RuntimeParityFixtureSchema)(content).pipe(Effect.asVoid)),
    Match.exhaustive
  )
