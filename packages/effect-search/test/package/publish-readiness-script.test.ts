import { Command, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Stream } from "effect"

const packageRootUrl = new URL("../../", import.meta.url)

const resolvePackageRoot = Effect.gen(function*() {
  const path = yield* Path.Path

  return yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
})

const runPublishCheck = (root: string, args: ReadonlyArray<string>) =>
  Effect.gen(function*() {
    const command = Command.make("bun", "run", "scripts/verify-publish-readiness.ts", ...args).pipe(
      Command.workingDirectory(root),
      Command.stdout("pipe"),
      Command.stderr("pipe")
    )
    const runningProcess = yield* Command.start(command)
    const [exitCode, stdout, stderr] = yield* Effect.all(
      [
        runningProcess.exitCode,
        Stream.decodeText(runningProcess.stdout).pipe(Stream.runFold("", (acc, chunk) => `${acc}${chunk}`)),
        Stream.decodeText(runningProcess.stderr).pipe(Stream.runFold("", (acc, chunk) => `${acc}${chunk}`))
      ],
      { concurrency: "unbounded" }
    )

    return {
      exitCode: Number(exitCode),
      stdout,
      stderr
    }
  }).pipe(Effect.scoped)

describe("package/publish-readiness-script", () => {
  it.effect("wires publish:check into package scripts and release flow", () =>
    Effect.gen(function*() {
      const root = yield* resolvePackageRoot
      const result = yield* runPublishCheck(root, [])

      expect(result.exitCode).toBe(0)
      expect(result.stderr).not.toContain("scripts.publish-check.missing")
      expect(result.stderr).not.toContain("scripts.changeset-publish.missing-contract-check")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("emits actionable diagnostics for metadata, export, and keyword drift", () =>
    Effect.gen(function*() {
      const root = yield* resolvePackageRoot
      const fixtureRoot = `${root}/test/package/fixtures`
      const result = yield* runPublishCheck(root, [
        "--require-packed-manifest",
        `--root-manifest=${fixtureRoot}/package.drift-all.json`,
        `--packed-manifest=${fixtureRoot}/dist.package.valid.json`,
        `--readme=${fixtureRoot}/README.valid.md`
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("metadata.repository.url-forbidden")
      expect(result.stderr).toContain("exports.root.missing-subpaths")
      expect(result.stderr).toContain("keywords.required-missing")
    }).pipe(Effect.provide(BunContext.layer)))
})
