import { Effect, Match, Schema } from "effect"
import {
  Blake3FixtureSchema,
  type FixtureKind,
  FixtureKindSchema,
  FixtureManifestSchema,
  HashFixtureSchema,
  HkdfCorpusFixtureSchema,
  HmacFixtureSchema,
  JcsFixtureSchema,
  UnicodeAdversarialFixtureSchema
} from "./fixture-schemas.js"

export const EXTERNAL_FIXTURE_ROOT = "test/fixtures/external"
export const MANIFEST_FILE = "sources.manifest.json"
export { FixtureKindSchema, FixtureManifestSchema }
export type { FixtureKind }

export const decodeUnknownJson = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))

export const validateFixtureByKind = (
  kind: FixtureKind,
  content: string
): Effect.Effect<void, unknown, never> =>
  Match.value(kind).pipe(
    Match.when("blake3", () =>
      Schema.decodeUnknown(Blake3FixtureSchema)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)),
    Match.when("jcs", () =>
      Schema.decodeUnknown(JcsFixtureSchema)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)),
    Match.when("hash", () =>
      Schema.decodeUnknown(HashFixtureSchema)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)),
    Match.when("hmac", () =>
      Schema.decodeUnknown(HmacFixtureSchema)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)),
    Match.when("hkdf", () =>
      Schema.decodeUnknown(HkdfCorpusFixtureSchema)(content, { onExcessProperty: "error" }).pipe(Effect.asVoid)),
    Match.when("unicode-adversarial", () =>
      Schema.decodeUnknown(UnicodeAdversarialFixtureSchema)(content, { onExcessProperty: "error" }).pipe(
        Effect.asVoid
      )),
    Match.exhaustive
  )
