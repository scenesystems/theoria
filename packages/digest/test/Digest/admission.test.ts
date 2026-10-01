import { expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"

import * as Digest from "@scenesystems/digest/Digest"

it.effect("Digest.Algorithm admits supported names and rejects unknown names", () => {
  expect(Schema.decodeUnknownEither(Digest.Algorithm)("blake3-256")).toSatisfy(Either.isRight)
  expect(Schema.decodeUnknownEither(Digest.Algorithm)("sha256")).toSatisfy(Either.isRight)
  expect(Schema.decodeUnknownEither(Digest.Algorithm)("md5")).toSatisfy(Either.isLeft)
  return Effect.void
})
