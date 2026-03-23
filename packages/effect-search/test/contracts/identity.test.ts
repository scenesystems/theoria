import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

describe("contracts/identity", () => {
  it.effect("RunId accepts valid ULID", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decode(Contracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      expect(runId).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV")
    }))

  it.effect("RunId rejects invalid ULID", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decode(Contracts.RunId)("not-a-ulid").pipe(Effect.either)
      expect(result._tag).toBe("Left")
    }))

  it.effect("PackageVersion accepts valid semver", () =>
    Effect.gen(function*() {
      const version = yield* Schema.decode(Contracts.PackageVersion)("1.2.3")
      expect(version).toBe("1.2.3")
    }))

  it.effect("PackageVersion rejects non-semver", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decode(Contracts.PackageVersion)("abc").pipe(Effect.either)
      expect(result._tag).toBe("Left")
    }))

  it.effect("PackageVersion rejects empty string", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decode(Contracts.PackageVersion)("").pipe(Effect.either)
      expect(result._tag).toBe("Left")
    }))

  it.effect("ArtifactId carries branded RunId and sequence", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decode(Contracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const artifactId = new Contracts.ArtifactId({ runId, sequence: 42 })
      expect(artifactId.runId).toBe(runId)
      expect(artifactId.sequence).toBe(42)
    }))

  it.effect("SourceRef constructs with structured fields", () =>
    Effect.gen(function*() {
      const sourceRef = new Contracts.SourceRef({
        origin: "effect-search",
        domain: "study",
        segments: ["trial", "log"]
      })
      expect(sourceRef.origin).toBe("effect-search")
      expect(sourceRef.domain).toBe("study")
      expect(sourceRef.segments).toEqual(["trial", "log"])
    }))

  it.effect("ContentDigest constructs with algorithm and digest", () =>
    Effect.gen(function*() {
      const digest = new Contracts.ContentDigest({
        algorithm: "blake3-256",
        digest: "abc123def456"
      })
      expect(digest.algorithm).toBe("blake3-256")
      expect(digest.digest).toBe("abc123def456")
    }))

  it.effect("ComponentPath accepts non-empty array of non-empty strings", () =>
    Effect.gen(function*() {
      const component = yield* Schema.decode(Contracts.ComponentPath)(["Study", "snapshot"])
      expect(component).toEqual(["Study", "snapshot"])
    }))
})
