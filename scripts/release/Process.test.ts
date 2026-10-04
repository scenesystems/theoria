import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { ChildProcess } from "effect/process"
import { CommandFailed, output } from "./Process.js"

describe("release process output", () => {
  it.effect("returns stdout when the subprocess exits successfully", () =>
    output(ChildProcess.make("sh", ["-c", "printf release-output"])).pipe(
      Effect.provide(BunServices.layer),
      Effect.map((text) => expect(text).toBe("release-output"))
    ))

  it.effect("fails with the subprocess exit status", () =>
    output(ChildProcess.make("sh", ["-c", "exit 23"])).pipe(
      Effect.provide(BunServices.layer),
      Effect.catchTag("PlatformError", Effect.die),
      Effect.flip,
      Effect.map((failure) => {
        expect(failure).toBeInstanceOf(CommandFailed)
        expect(failure.exitCode).toBe(23)
      })
    ))
})
