import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Stream } from "effect"
import { ChildProcess } from "effect/process"

const ready = (args: ReadonlyArray<string>) =>
  Effect.scoped(Effect.gen(function*() {
    const child = yield* ChildProcess.make("bun", ["scripts/release.ts", "ready", ...args], {
      env: { CHANGESETS_MODE: "none" },
      extendEnv: true,
      stdout: "pipe",
      stderr: "pipe"
    })
    return yield* Effect.all({
      code: child.exitCode,
      stdout: child.stdout.pipe(Stream.decodeText(), Stream.runCollect, Effect.map(Array.join(""))),
      stderr: child.stderr.pipe(Stream.decodeText(), Stream.runCollect, Effect.map(Array.join("")))
    }, { concurrency: "unbounded" })
  })).pipe(Effect.provide(BunServices.layer))

describe("release CLI argument and configuration validation", () => {
  it.effect("uses the configured mode when no flag is supplied", () =>
    Effect.gen(function*() {
      const result = yield* ready([])
      expect(result.code).toBe(0)
      expect(result.stdout).toContain("Every candidate package version is already published.")
    }))

  it.effect("rejects an invalid explicit mode instead of using the valid environment fallback", () =>
    Effect.gen(function*() {
      const result = yield* ready(["--mode", "invalid"])
      expect(result.code).not.toBe(0)
      expect(result.stdout + result.stderr).toContain("invalid")
      expect(result.stdout).not.toContain("Every candidate package version is already published.")
    }))
})
