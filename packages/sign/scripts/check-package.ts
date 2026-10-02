/** Exercise an isolated packed installation in Bun and native workerd. */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import {
  Array as Arr,
  Config,
  Data,
  Effect,
  FileSystem,
  Number as N,
  Path,
  Record,
  Schema,
  String as Str
} from "effect"
import { ChildProcess as Command, ChildProcessSpawner } from "effect/process"

class PackageCheckFailed extends Data.TaggedError("PackageCheckFailed")<{
  readonly operation: string
}> {}

const execute = (command: Command.Command, operation: string) =>
  Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) => spawner.exitCode(command)).pipe(
    Effect.filterOrFail((code) => N.Equivalence(code, 0), () => new PackageCheckFailed({ operation }))
  )

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const script = yield* path.fromFileUrl(yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url))
  const root = path.resolve(path.dirname(script), "..")
  const repository = path.resolve(root, "../..")
  const temporary = yield* fs.makeTempDirectoryScoped()
  const versions = yield* fs.readFileString(path.join(repository, "package.json")).pipe(
    Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({
      devDependencies: Schema.Struct({
        effect: Schema.String,
        "@effect/platform-bun": Schema.String,
        "@effect/vitest": Schema.String
      }),
      overrides: Schema.Record(Schema.String, Schema.String)
    }))))
  )
  // Bun resolves workspace:^ while packing only inside a registered workspace.
  // Stage the built distributions together; never rewrite the release outputs.
  const staging = yield* fs.makeTempDirectoryScoped()
  yield* Effect.forEach(
    Arr.make("digest", "sign"),
    (name) => fs.copy(path.join(repository, "packages", name, "dist"), path.join(staging, name))
  )
  yield* fs.writeFileString(
    path.join(staging, "package.json"),
    yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Struct({
      private: Schema.Boolean,
      workspaces: Schema.Array(Schema.String),
      dependencies: Schema.Record(Schema.String, Schema.String)
    })))({
      private: true,
      workspaces: Arr.make("digest", "sign"),
      dependencies: { effect: versions.devDependencies.effect }
    })
  )
  yield* execute(
    Command.make("bun", ["install", "--ignore-scripts", "--no-progress"], {
      cwd: staging,
      stdout: "inherit",
      stderr: "inherit"
    }),
    "resolve staged workspace versions"
  )
  yield* Effect.forEach(Arr.make("digest", "sign"), (name) =>
    execute(
      Command.make(
        "bun",
        ["pm", "pack", "--ignore-scripts", "--quiet", "--filename", path.join(temporary, Str.concat(name, ".tgz"))],
        { cwd: path.join(staging, name), stdout: "inherit", stderr: "inherit" }
      ),
      Str.concat("pack built ", name)
    ))
  const { version: vitestVersion } = yield* fs.readFileString(path.join(repository, "node_modules/vitest/package.json"))
    .pipe(Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({ version: Schema.NonEmptyString })))))
  const manifest = Schema.fromJsonString(Schema.Struct({
    private: Schema.Literal(true),
    type: Schema.Literal("module"),
    dependencies: Schema.Record(Schema.String, Schema.String),
    overrides: Schema.Record(Schema.String, Schema.String)
  }))
  yield* fs.writeFileString(
    path.join(temporary, "package.json"),
    yield* Schema.encodeEffect(manifest)({
      private: true,
      type: "module",
      dependencies: {
        "@scenesystems/sign": path.join(temporary, "sign.tgz"),
        "@scenesystems/digest": path.join(temporary, "digest.tgz"),
        effect: versions.devDependencies.effect,
        "@effect/platform-bun": versions.devDependencies["@effect/platform-bun"],
        "@effect/vitest": versions.devDependencies["@effect/vitest"],
        vitest: vitestVersion
      },
      // Resolve sign's transitive digest dependency to the same candidate tarball.
      // Its not-yet-bumped version may also exist in the public registry.
      overrides: Record.set(versions.overrides, "@scenesystems/digest", path.join(temporary, "digest.tgz"))
    })
  )
  yield* fs.makeDirectory(path.join(temporary, "scripts/worker"), { recursive: true })
  yield* fs.makeDirectory(path.join(temporary, "test/fixtures/conformance"), { recursive: true })
  yield* fs.makeDirectory(path.join(temporary, "test/worker"))
  yield* Effect.forEach(
    Arr.make(
      "test/Rsa.test.ts",
      "test/Jwt.test.ts",
      "scripts/worker/protocol.ts",
      "scripts/worker/entry.ts",
      "scripts/worker/runtime.ts",
      "test/worker/verification.spec.ts",
      "vitest.worker.config.ts",
      "scripts/fixture-contract.ts",
      "scripts/jwt-fixture-contract.ts",
      "scripts/benchmark.ts",
      "scripts/benchmark-worker.ts",
      "test/fixtures/conformance/rsa-openssl.json",
      "test/fixtures/conformance/jwt-openssl.json",
      "test/fixtures/conformance/jwt-access-openssl.json",
      "test/fixtures/conformance/rsa-wycheproof.json"
    ),
    (file) => fs.copyFile(path.join(root, file), path.join(temporary, file))
  )
  yield* execute(
    Command.make("bun", ["install", "--ignore-scripts", "--no-progress"], {
      cwd: temporary,
      stdout: "inherit",
      stderr: "inherit"
    }),
    "install isolated packed consumer"
  )
  yield* execute(
    Command.make("bun", ["run", "--bun", "vitest", "run", "test/Rsa.test.ts", "test/Jwt.test.ts"], {
      cwd: temporary,
      stdout: "inherit",
      stderr: "inherit"
    }),
    "verify packed public API"
  )
  yield* fs.copyFile(path.join(root, "scripts/worker/config.capnp"), path.join(temporary, "config.capnp"))
  yield* execute(
    Command.make("bun", ["build", "scripts/worker/entry.ts", "--target=browser", "--outfile=worker.mjs"], {
      cwd: temporary,
      stdout: "inherit",
      stderr: "inherit"
    }),
    "bundle packed public API for workerd"
  )
  const miniflare = yield* fs.realPath(path.join(repository, "apps/theoria/node_modules/miniflare"))
  const binary = yield* fs.realPath(path.resolve(miniflare, "../workerd/bin/workerd"))
  yield* execute(
    Command.make("bun", ["run", "--bun", "vitest", "run", "--config", "vitest.worker.config.ts"], {
      cwd: temporary,
      env: { SIGN_WORKERD: binary },
      extendEnv: true,
      stdout: "inherit",
      stderr: "inherit"
    }),
    "verify packed public API in workerd"
  )
  const benchmark = yield* Config.Boolean("SIGN_WORKER_BENCHMARK").pipe(Config.withDefault(false))
  yield* execute(
    Command.make("bun", ["run", "scripts/benchmark-worker.ts"], {
      cwd: temporary,
      env: { SIGN_WORKERD: binary },
      extendEnv: true,
      stdout: "inherit",
      stderr: "inherit"
    }),
    "measure packed public API in workerd"
  ).pipe(Effect.when(Effect.succeed(benchmark)))
}).pipe(Effect.scoped, Effect.provide(BunServices.layer))

BunRuntime.runMain(program)
