import { Command, FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { resolveRootFrom } from "@theoria/source-proof"

const Manifest = Schema.parseJson(
  Schema.Struct({
    scripts: Schema.Record({ key: Schema.String, value: Schema.String })
  })
)

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/publish-readiness-script", () => {
  it.effect("wires digest into the shared release checker before Changesets publish", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const manifest = yield* fileSystem.readFileString(path.join(root, "package.json")).pipe(
        Effect.flatMap(Schema.decodeUnknown(Manifest)),
        Effect.orDie
      )

      expect(manifest.scripts["publish:check"]).toBe("bun run scripts/verify-publish-readiness.ts")
      expect(manifest.scripts["changeset-publish"]).toBe(
        "bun run build && bun run publish:check --require-packed-manifest && bun run test && changeset publish"
      )
      expect(yield* fileSystem.exists(path.join(root, "scripts/verify-publish-readiness.ts"))).toBe(true)

      const exitCode = yield* Command.make("bun", "run", "publish:check").pipe(
        Command.workingDirectory(root),
        Command.stdout("inherit"),
        Command.stderr("inherit"),
        Command.exitCode
      )
      expect(Number(exitCode)).toBe(0)
    }).pipe(Effect.provide(BunContext.layer)))
})
