import { Command, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Stream } from "effect"

const MONOREPO_TOPOLOGY_TODO_CODE = "metadata.monorepo.topology-todo"

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

describe("package/repository-metadata", () => {
  it.effect("keeps repository metadata free from scenesystems/eva fallback", () =>
    Effect.gen(function*() {
      const root = yield* resolvePackageRoot
      const fixtureRoot = `${root}/test/package/fixtures`
      const result = yield* runPublishCheck(root, [
        `--root-manifest=${fixtureRoot}/package.base.json`,
        `--readme=${fixtureRoot}/README.valid.md`
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stderr).not.toContain("metadata.repository.url-forbidden")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces scenesystems/theoria monorepo repository metadata", () =>
    Effect.gen(function*() {
      const root = yield* resolvePackageRoot
      const fixtureRoot = `${root}/test/package/fixtures`
      const result = yield* runPublishCheck(root, [
        `--root-manifest=${fixtureRoot}/package.base.json`,
        `--readme=${fixtureRoot}/README.valid.md`,
        "--enforce-monorepo-topology"
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stderr).not.toContain(MONOREPO_TOPOLOGY_TODO_CODE)
      expect(result.stderr).not.toContain("metadata.monorepo.target-mismatch")
    }).pipe(Effect.provide(BunContext.layer)))
})
