import { expect, it } from "@effect/vitest"
import { Effect, Exit, Schema } from "effect"

import * as Digest from "@scenesystems/digest/Digest"

it.effect("Digest.Algorithm admits supported names and rejects unknown names", () => {
  const unsupported: unknown = "md5"
  expect(Schema.decodeExit(Digest.Algorithm)("blake3-256")).toSatisfy(Exit.isSuccess)
  expect(Schema.decodeExit(Digest.Algorithm)("sha256")).toSatisfy(Exit.isSuccess)
  expect(Schema.decodeUnknownExit(Digest.Algorithm)(unsupported)).toSatisfy(Exit.isFailure)
  return Effect.void
})
