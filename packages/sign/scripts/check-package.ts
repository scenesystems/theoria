/** Exercise an isolated packed installation in Bun and native workerd. */
import { Command, FileSystem, Path, Url } from "@effect/platform"
import * as BunContext from "@effect/platform-bun/BunContext"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import { Array as Arr, Config, Effect, Number as N, Schema } from "effect"

class PackageCheckFailed extends Schema.TaggedError<PackageCheckFailed>()("PackageCheckFailed", {
  operation: Schema.String
}) {}

const execute = (command: Command.Command, operation: string) =>
  command.pipe(
    Command.stdout("inherit"),
    Command.stderr("inherit"),
    Command.exitCode,
    Effect.filterOrFail((code) => N.Equivalence(code, 0), () => new PackageCheckFailed({ operation }))
  )

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* path.fromFileUrl(yield* Url.fromString("../", import.meta.url))
  const repository = path.resolve(root, "../..")
  const temporary = yield* fs.makeTempDirectoryScoped()
  const tarball = path.join(temporary, "sign.tgz")
  yield* execute(
    Command.make("bun", "pm", "pack", "--ignore-scripts", "--quiet", "--filename", tarball).pipe(
      Command.workingDirectory(path.join(root, "dist"))
    ),
    "pack built package"
  )
  const versions = yield* fs.readFileString(path.join(repository, "package.json")).pipe(
    Effect.flatMap(Schema.decode(Schema.parseJson(Schema.Struct({
      devDependencies: Schema.Struct({
        effect: Schema.String,
        "@effect/platform": Schema.String,
        "@effect/platform-bun": Schema.String,
        "@effect/vitest": Schema.String
      }),
      overrides: Schema.Record({ key: Schema.String, value: Schema.String })
    }))))
  )
  const { version: vitestVersion } = yield* fs.readFileString(path.join(repository, "node_modules/vitest/package.json"))
    .pipe(Effect.flatMap(Schema.decode(Schema.parseJson(Schema.Struct({ version: Schema.NonEmptyString })))))
  const manifest = Schema.parseJson(Schema.Struct({
    private: Schema.Literal(true),
    type: Schema.Literal("module"),
    dependencies: Schema.Record({ key: Schema.String, value: Schema.String }),
    overrides: Schema.Record({ key: Schema.String, value: Schema.String })
  }))
  yield* fs.writeFileString(
    path.join(temporary, "package.json"),
    yield* Schema.encode(manifest)({
      private: true,
      type: "module",
      dependencies: {
        "@scenesystems/sign": tarball,
        effect: versions.devDependencies.effect,
        "@effect/platform": versions.devDependencies["@effect/platform"],
        "@effect/platform-bun": versions.devDependencies["@effect/platform-bun"],
        "@effect/vitest": versions.devDependencies["@effect/vitest"],
        vitest: vitestVersion
      },
      overrides: versions.overrides
    })
  )
  yield* fs.makeDirectory(path.join(temporary, "scripts/worker"), { recursive: true })
  yield* fs.makeDirectory(path.join(temporary, "test/fixtures/conformance"), { recursive: true })
  yield* fs.makeDirectory(path.join(temporary, "test/worker"))
  yield* Effect.forEach(
    Arr.make(
      "test/rsa.test.ts",
      "test/jwt.test.ts",
      "scripts/worker/protocol.ts",
      "scripts/worker/entry.ts",
      "scripts/worker/runtime.ts",
      "test/worker/verification.spec.ts",
      "vitest.worker.config.ts",
      "scripts/fixture-contract.ts",
      "scripts/jwt-fixture-contract.ts",
      "scripts/benchmark-worker.ts",
      "test/fixtures/conformance/rsa-openssl.json",
      "test/fixtures/conformance/jwt-openssl.json",
      "test/fixtures/conformance/jwt-access-openssl.json",
      "test/fixtures/conformance/rsa-wycheproof.json"
    ),
    (file) => fs.copyFile(path.join(root, file), path.join(temporary, file))
  )
  yield* execute(
    Command.make("bun", "install", "--ignore-scripts", "--no-progress").pipe(
      Command.workingDirectory(temporary)
    ),
    "install isolated packed consumer"
  )
  yield* execute(
    Command.make("bun", "run", "--bun", "vitest", "run", "test/rsa.test.ts", "test/jwt.test.ts").pipe(
      Command.workingDirectory(temporary)
    ),
    "verify packed public API"
  )
  yield* fs.copyFile(path.join(root, "scripts/worker/config.capnp"), path.join(temporary, "config.capnp"))
  yield* execute(
    Command.make("bun", "build", "scripts/worker/entry.ts", "--target=browser", "--outfile=worker.mjs").pipe(
      Command.workingDirectory(temporary)
    ),
    "bundle packed public API for workerd"
  )
  const miniflare = yield* fs.realPath(path.join(repository, "apps/theoria/node_modules/miniflare"))
  const binary = yield* fs.realPath(path.resolve(miniflare, "../workerd/bin/workerd"))
  yield* execute(
    Command.make("bun", "run", "--bun", "vitest", "run", "--config", "vitest.worker.config.ts").pipe(
      Command.workingDirectory(temporary),
      Command.env({ SIGN_WORKERD: binary })
    ),
    "verify packed public API in workerd"
  )
  const benchmark = yield* Config.boolean("SIGN_WORKER_BENCHMARK").pipe(Config.withDefault(false))
  yield* execute(
    Command.make("bun", "run", "scripts/benchmark-worker.ts").pipe(
      Command.workingDirectory(temporary),
      Command.env({ SIGN_WORKERD: binary })
    ),
    "measure packed public API in workerd"
  ).pipe(Effect.when(() => benchmark))
}).pipe(Effect.scoped, Effect.provide(BunContext.layer))

BunRuntime.runMain(program)
