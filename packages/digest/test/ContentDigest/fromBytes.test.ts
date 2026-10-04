import { expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { encodeFixtureUtf8 } from "../helpers/bytes.js"

it.effect("ContentDigest.fromBytes hashes raw input without canonicalization", () =>
  Effect.gen(function*() {
    const digest = yield* ContentDigest.fromBytes("sha256", encodeFixtureUtf8("hello"))

    expect(digest.algorithm).toBe("sha256")
    expect(digest.digest).toBe("LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ")
    expect(ContentDigest.toString(digest)).toBe("sha256:LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ")
  }))
