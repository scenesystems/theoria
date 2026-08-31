/**
 * One auditable owner for the sign release sequence: derive and embed the
 * verifier descriptor, then qualify and bind the packed bytes. Keeping the
 * ordering in one Effect program makes descriptor/package cycles reviewable.
 * If a second provider adopts this descriptor model, split reusable schemas
 * and profile derivation from this entrypoint without moving release authority
 * back into package-local scripts.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { chromium } from "@playwright/test"
import { parseJsonc } from "@theoria/source-proof"
import { Array as Arr, Console, Effect, Option, Order, Record, Schema } from "effect"

import * as Digest from "../../packages/digest/src/index.js"
import { CryptoReleaseCheckError, readSha256Hex, runCommand, runCommandExit } from "./shared.js"
import { runSignRuntimeReport, type SignRuntimeModuleMode } from "./sign-runtime-report.js"

const rootUrl = new URL("../../", import.meta.url)
const PACKAGE_NAME = "@scenesystems/sign"
const PACKAGE_DIRECTORY = "packages/sign"
const FIXTURE_FILES = ["ed25519.json", "p256.json", "ml-dsa-65.json"]
const PROVIDERS = [
  {
    name: "@noble/curves",
    version: "2.0.1",
    integrity: "sha512-vs1Az2OOTBiP4q0pwjW5aF0xp9n4MxVrmkFBxc6EKZc6ddYx5gaZiAsZoq0uRRXWbi3AT/sBqn05eRPtn1JCPw=="
  },
  {
    name: "@noble/hashes",
    version: "2.0.1",
    integrity: "sha512-XlOlEbQcE9fmuXxrVTXCTlG2nlRXa9Rj3rr5Ue/+tX+nmkgbX720YHh0VR3hBF9xDvwnb8D2shVGOwNx+ulArw=="
  },
  {
    name: "@noble/post-quantum",
    version: "0.5.4",
    integrity: "sha512-leww0zzIirrvwaYMPI9fj6aRIlA/c6Y0/lifQQ1YOOyHEr0MNH3yYpjXeiVG+tWdPps4XxGclFWX2INPO3Yo5w=="
  }
]
const TOOL_PACKAGES = [
  "typescript",
  "@effect/build-utils",
  "@babel/core",
  "@babel/cli",
  "babel-plugin-annotate-pure-calls",
  "@babel/plugin-transform-export-namespace-from",
  "@babel/plugin-transform-modules-commonjs",
  "@playwright/test"
]
const CONFIG_FILES = [
  "tsconfig.base.json",
  "tsconfig.build.base.json",
  "packages/sign/tsconfig.src.json",
  "packages/sign/tsconfig.build.json",
  "scripts/tsconfig.json",
  ".prettierrc",
  "eslint.config.mjs"
]
const HOST_RUNTIMES: ReadonlyArray<{ readonly runtime: string; readonly mode: SignRuntimeModuleMode }> = [
  { runtime: "node", mode: "esm" },
  { runtime: "node", mode: "cjs" },
  { runtime: "bun", mode: "esm" }
]

const Sha256 = Schema.String.pipe(Schema.pattern(/^[0-9a-f]{64}$/))
const FileIdentity = Schema.Struct({ path: Schema.NonEmptyString, sha256: Sha256 })
const DescriptorBody = Schema.Struct({
  packageName: Schema.Literal(PACKAGE_NAME),
  packageVersion: Schema.NonEmptyString,
  source: Schema.Struct({
    repository: Schema.NonEmptyString,
    revision: Schema.NonEmptyString,
    state: Schema.Literal("clean", "dirty"),
    files: Schema.Array(FileIdentity)
  }),
  lock: Schema.Struct({ path: Schema.Literal("bun.lock"), sha256: Sha256 }),
  providers: Schema.Array(
    Schema.Struct({ name: Schema.NonEmptyString, version: Schema.NonEmptyString, integrity: Schema.NonEmptyString })
  ),
  toolchain: Schema.Unknown,
  suiteProfiles: Schema.Unknown,
  corpus: Schema.Struct({
    totalCases: Schema.Positive,
    payloads: Schema.Array(FileIdentity),
    provenance: FileIdentity
  }),
  artifacts: Schema.Struct({ files: Schema.Array(FileIdentity), aggregateSha256: Sha256 })
})
const VerifierDescriptor = Schema.Struct({
  format: Schema.Literal("@scenesystems/sign-verifier-v1"),
  body: DescriptorBody,
  fingerprint: Sha256
})
const VerifierDescriptorJson = Schema.parseJson(VerifierDescriptor)
const ManifestJson = Schema.parseJson(Schema.Struct({
  name: Schema.Literal(PACKAGE_NAME),
  version: Schema.NonEmptyString,
  exports: Schema.Struct({ ".": Schema.Literal("./src/index.ts") }),
  dependencies: Schema.Struct({
    "@noble/curves": Schema.Literal("2.0.1"),
    "@noble/hashes": Schema.Literal("2.0.1"),
    "@noble/post-quantum": Schema.Literal("0.5.4")
  })
}))
const BunLock = Schema.Struct({ packages: Schema.Record({ key: Schema.String, value: Schema.Unknown }) })
const Fixture = Schema.parseJson(Schema.Struct({ cases: Schema.Array(Schema.Unknown) }))
const ClassificationCounts = Schema.Struct({
  verified: Schema.NonNegativeInt,
  nonmatch: Schema.NonNegativeInt,
  invalidInput: Schema.NonNegativeInt
})
const BrowserRuntimeReport = Schema.Struct({
  format: Schema.Literal("@scenesystems/sign-browser-runtime-v1"),
  corpusCases: Schema.Positive,
  classifications: ClassificationCounts
})

const failure = (stage: string, detail: string) => new CryptoReleaseCheckError({ stage, detail })
const root = Path.Path.pipe(
  Effect.flatMap((path) => path.fromFileUrl(rootUrl)),
  Effect.mapError(() => failure("sign-root", "could not resolve repository root"))
)
const canonicalHash = (value: unknown) =>
  Digest.canonicalJsonBytes(value).pipe(
    Effect.flatMap((bytes) => Digest.sha256(bytes)),
    Effect.map(Digest.toHex),
    Effect.mapError(() => failure("sign-canonical-hash", "value is not canonical JSON"))
  )
const renderCanonical = (value: unknown) =>
  Digest.canonicalize(value).pipe(
    Effect.mapError(() => failure("sign-canonical-json", "value is not canonical JSON"))
  )
const decodeFile = <A, I>(path: string, schema: Schema.Schema<A, I>) =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fileSystem) => fileSystem.readFileString(path)),
    Effect.flatMap(Schema.decodeUnknown(schema)),
    Effect.mapError(() => failure("sign-decode", path))
  )
const identities = (rootDirectory: string, paths: ReadonlyArray<string>) =>
  Effect.forEach(
    Arr.sort(paths, Order.string),
    (entry) => readSha256Hex(`${rootDirectory}/${entry}`).pipe(Effect.map((sha256) => ({ path: entry, sha256 })))
  )

const playwrightEffect = <A>(stage: string, evaluate: () => Promise<A>) =>
  Effect.tryPromise({
    try: evaluate,
    catch: () => failure(stage, "Playwright operation failed")
  })

const runBrowserProfile = (workspace: string, consumer: string, fixtureRoot: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const readFixture = (file: string) =>
      fileSystem.readFileString(path.join(fixtureRoot, file)).pipe(
        Effect.mapError(() => failure("sign-browser-profile", file))
      )
    const ed25519 = yield* readFixture("ed25519.json")
    const p256 = yield* readFixture("p256.json")
    const mlDsa65 = yield* readFixture("ml-dsa-65.json")
    yield* fileSystem.writeFileString(
      path.join(consumer, "sign-browser-profile.ts"),
      `export default {"ed25519":${ed25519},"p256":${p256},"mlDsa65":${mlDsa65}}\n`
    )
    yield* fileSystem.copyFile(
      path.join(workspace, "scripts/crypto-release/sign-browser-runtime.ts"),
      path.join(consumer, "sign-browser-runtime.ts")
    )
    yield* fileSystem.writeFileString(
      path.join(consumer, "sign-browser-entry.ts"),
      [
        "import { Runtime } from \"effect\"",
        "import profile from \"./sign-browser-profile.ts\"",
        "import { runSignBrowserProfile } from \"./sign-browser-runtime.ts\"",
        "Reflect.set(globalThis, \"__THEORIA_SIGN_RELEASE_REPORT__\",",
        "  Runtime.runSync(Runtime.defaultRuntime)(runSignBrowserProfile(profile)))",
        ""
      ].join("\n")
    )
    const playwright = yield* runCommand("sign-playwright-version", workspace, "bunx", ["playwright", "--version"])
    yield* runCommand("sign-playwright-install", workspace, "bunx", ["playwright", "install", "chromium"])
    yield* runCommand("sign-browser-bundle", consumer, "bun", [
      "build",
      "sign-browser-entry.ts",
      "--target",
      "browser",
      "--outfile",
      "sign-browser-profile.js"
    ])
    const browser = yield* Effect.acquireRelease(
      playwrightEffect("sign-browser-launch", () => chromium.launch({ headless: true })),
      (instance) => Effect.promise(() => instance.close())
    )
    const page = yield* playwrightEffect("sign-browser-page", () => browser.newPage())
    yield* playwrightEffect("sign-browser-content", () =>
      page.setContent("<!doctype html><title>sign release profile</title>"))
    yield* playwrightEffect("sign-browser-script", () =>
      page.addScriptTag({ path: path.join(consumer, "sign-browser-profile.js") }))
    const unknownReport = yield* playwrightEffect("sign-browser-report", () =>
      page.evaluate(() =>
        Reflect.get(globalThis, "__THEORIA_SIGN_RELEASE_REPORT__")
      ))
    const report = yield* Schema.decodeUnknown(BrowserRuntimeReport)(unknownReport).pipe(
      Effect.mapError(() =>
        failure("sign-browser-report", "browser returned an invalid report")
      )
    )
    return { playwright, chromium: browser.version(), report }
  }).pipe(Effect.scoped)

const buildDescriptorBody = (workspace: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const packageRoot = path.join(workspace, PACKAGE_DIRECTORY)
    const manifest = yield* decodeFile(path.join(packageRoot, "package.json"), ManifestJson)
    const lockText = yield* fileSystem.readFileString(path.join(workspace, "bun.lock")).pipe(
      Effect.mapError(() => failure("sign-lock", "could not read bun.lock"))
    )
    const parsedLock = yield* Option.match(parseJsonc("bun.lock", lockText), {
      onNone: () => Effect.fail(failure("sign-lock", "bun.lock is not valid JSONC")),
      onSome: Effect.succeed
    })
    const lock = yield* Schema.decodeUnknown(BunLock)(parsedLock).pipe(
      Effect.mapError(() => failure("sign-lock", "bun.lock packages map is invalid"))
    )
    const providers = yield* Effect.forEach(PROVIDERS, ({ name, version, integrity }) =>
      Option.match(
        Record.get(lock.packages, name),
        {
          onNone: () => Effect.fail(failure("sign-provider-lock", name)),
          onSome: (entry) =>
            Schema.decodeUnknown(
              Schema.Tuple(
                Schema.Literal(`${name}@${version}`),
                Schema.Literal(""),
                Schema.Unknown,
                Schema.Literal(integrity)
              )
            )(entry).pipe(
              Effect.as({ name, version, integrity }),
              Effect.mapError(() => failure("sign-provider-lock", name))
            )
        }
      ))
    const listedSource = yield* runCommand("sign-source-files", workspace, "git", [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      PACKAGE_DIRECTORY,
      ".github/workflows/check.yml",
      "scripts/crypto-release/sign.ts",
      "scripts/crypto-release/sign-browser-runtime.ts",
      "scripts/crypto-release/sign-runtime-report.ts",
      "scripts/crypto-release/sign-runtime.mjs"
    ])
    const sourcePaths = Arr.filter(listedSource.split("\n"), (entry) =>
      entry.length > 0 &&
      !entry.includes("/build/") && !entry.includes("/dist/") && !entry.includes(".tsbuildinfo"))
    const existingSourcePaths = yield* Effect.filter(
      sourcePaths,
      (sourcePath) =>
        fileSystem.exists(path.join(workspace, sourcePath)).pipe(
          Effect.mapError(() => failure("sign-source-files", sourcePath))
        ),
      { concurrency: "unbounded" }
    )
    const sourceFiles = yield* identities(workspace, existingSourcePaths)
    const status = yield* runCommand("sign-source-state", workspace, "git", [
      "status",
      "--porcelain",
      "--untracked-files=all"
    ])
    const revision = yield* runCommand("sign-source-revision", workspace, "git", ["rev-parse", "HEAD"])
    const node = yield* runCommand("sign-node-version", workspace, "node", ["--version"])
    const bun = yield* runCommand("sign-bun-version", workspace, "bun", ["--revision"])
    const tools = yield* Effect.forEach(TOOL_PACKAGES, (name) =>
      runCommand("sign-tool-version", workspace, "node", [
        "-e",
        `process.stdout.write(require(${
          Schema.encodeSync(Schema.parseJson(Schema.String))(`${name}/package.json`)
        }).version)`
      ]).pipe(Effect.map((version) => ({ name, version }))))
    const configs = yield* identities(workspace, CONFIG_FILES)
    const fixtureRoot = path.join(packageRoot, "test/fixtures/conformance")
    const payloads = yield* identities(fixtureRoot, FIXTURE_FILES)
    const counts = yield* Effect.forEach(FIXTURE_FILES, (file) =>
      decodeFile(path.join(fixtureRoot, file), Fixture).pipe(
        Effect.map((fixture) => fixture.cases.length)
      ))
    const provenance = (yield* identities(fixtureRoot, ["sources.manifest.json"]))[0]!
    const distRoot = path.join(packageRoot, "dist")
    const generatedEntries = yield* fileSystem.readDirectory(distRoot, { recursive: true }).pipe(
      Effect.mapError(() => failure("sign-artifacts", distRoot))
    )
    const generatedCandidates = Arr.filter(generatedEntries, (entry) =>
      /^dist\/(esm|cjs|dts)\/.+/.test(entry) && !entry.endsWith(".map"))
    const generatedPaths = Arr.flatten(
      yield* Effect.forEach(generatedCandidates, (entry) =>
        fileSystem.stat(path.join(distRoot, entry)).pipe(
          Effect.map((stat) =>
            stat.type === "File" ? [entry] : Arr.empty<string>()
          ),
          Effect.mapError(() => failure("sign-artifacts", entry))
        ))
    )
    const artifactFiles = yield* identities(distRoot, generatedPaths)
    const aggregateSha256 = yield* canonicalHash(artifactFiles)
    const lockSha256 = yield* readSha256Hex(path.join(workspace, "bun.lock"))
    return yield* Schema.decodeUnknown(DescriptorBody)({
      packageName: PACKAGE_NAME,
      packageVersion: manifest.version,
      source: {
        repository: "https://github.com/scenesystems/theoria.git",
        revision,
        state: status.length === 0 ? "clean" : "dirty",
        files: sourceFiles
      },
      lock: { path: "bun.lock", sha256: lockSha256 },
      providers,
      toolchain: {
        bun,
        node,
        tools,
        configs,
        build: [
          "tsc NodeNext ESM + declarations",
          "Babel annotated ESM",
          "Babel CommonJS",
          "@effect/build-utils pack-v3",
          "Bun browser bundle + Playwright Chromium"
        ]
      },
      suiteProfiles: {
        maximumMessageBytes: 8_192,
        interruptibility: "none",
        latencyMilliseconds: { p95: 10, max: 100 },
        ed25519: {
          mode: "pure RFC 8032",
          publicKeyBytes: 32,
          signatureBytes: 64,
          zip215: false,
          canonicalPoints: true,
          rejectSmallOrder: true,
          scalar: "S < L"
        },
        p256: {
          curve: "P-256",
          hash: "SHA-256 exactly once",
          publicKey: "65-byte uncompressed SEC1",
          signature: "64-byte P1363 low-S",
          scalarRange: "1 <= r,s < n"
        },
        mlDsa65: {
          mode: "pure FIPS 204",
          publicKeyBytes: 1_952,
          signatureBytes: 3_309,
          contextMaximumBytes: 255,
          identityV1ContextBytes: 0,
          canonicalHints: true
        }
      },
      corpus: {
        totalCases: Arr.reduce(counts, 0, (sum, count) => sum + count),
        payloads,
        provenance
      },
      artifacts: { files: artifactFiles, aggregateSha256 }
    }).pipe(Effect.mapError(() => failure("sign-descriptor", "constructed descriptor body is invalid")))
  })

const embed = (workspace: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const body = yield* buildDescriptorBody(workspace)
    const fingerprint = yield* canonicalHash(body)
    const encoded = yield* renderCanonical({ format: "@scenesystems/sign-verifier-v1", body, fingerprint })
    yield* fileSystem.writeFileString(
      path.join(workspace, PACKAGE_DIRECTORY, "dist/verifier-descriptor.json"),
      `${encoded}\n`
    )
    yield* Console.log(`[crypto:release:sign] embedded verifier ${fingerprint}`)
  })

const qualify = (workspace: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const packageRoot = path.join(workspace, PACKAGE_DIRECTORY)
    const descriptor = yield* decodeFile(
      path.join(packageRoot, "dist/verifier-descriptor.json"),
      VerifierDescriptorJson
    )
    const currentBody = yield* buildDescriptorBody(workspace)
    const currentFingerprint = yield* canonicalHash(currentBody)
    if (
      descriptor.fingerprint !== currentFingerprint || (descriptor.body.source.state !== "clean" &&
        !process.argv.includes("--allow-dirty"))
    ) return yield* Effect.fail(failure("sign-verifier", "stale or dirty descriptor"))
    const temporary = yield* fileSystem.makeTempDirectoryScoped({ prefix: "theoria-sign-release-" })
    const tarball = path.join(temporary, "sign.tgz")
    const consumer = path.join(temporary, "consumer")
    yield* fileSystem.makeDirectory(consumer, { recursive: true })
    yield* runCommand("sign-pack", path.join(packageRoot, "dist"), "bun", [
      "pm",
      "pack",
      "--filename",
      tarball,
      "--ignore-scripts",
      "--quiet"
    ])
    const consumerManifest = yield* renderCanonical({
      name: "sign-release-consumer",
      private: true,
      type: "module",
      dependencies: {
        [PACKAGE_NAME]: `file:${tarball}`,
        effect: "3.22.1",
        "@noble/curves": "2.0.1",
        "@noble/post-quantum": "0.5.4"
      }
    })
    yield* fileSystem.writeFileString(path.join(consumer, "package.json"), `${consumerManifest}\n`)
    yield* runCommand("sign-consumer-install", consumer, "bun", ["install", "--ignore-scripts", "--no-progress"])
    yield* fileSystem.copyFile(
      path.join(workspace, "scripts/crypto-release/sign-runtime.mjs"),
      path.join(consumer, "sign-runtime.mjs")
    )
    const fixtureRoot = path.join(packageRoot, "test/fixtures/conformance")
    const reports = yield* Effect.forEach(
      HOST_RUNTIMES,
      ({ runtime, mode }) =>
        runSignRuntimeReport(
          `sign-packed-${runtime}-${mode}`,
          consumer,
          runtime,
          ["sign-runtime.mjs", fixtureRoot, mode],
          mode
        )
    )
    if (Arr.some(reports, (report) => report.corpusCases !== descriptor.body.corpus.totalCases)) {
      return yield* Effect.fail(failure("sign-packed-corpus", "corpus count drifted"))
    }
    const browser = yield* runBrowserProfile(workspace, consumer, fixtureRoot)
    if (browser.report.corpusCases !== descriptor.body.corpus.totalCases) {
      return yield* Effect.fail(failure("sign-browser-corpus", "corpus count drifted"))
    }
    const baseline = yield* Option.match(Arr.head(reports), {
      onNone: () => Effect.fail(failure("sign-classification-parity", "no host runtime report")),
      onSome: (report) => Effect.succeed(report.classifications)
    })
    const classificationReports = [
      ...Arr.map(reports, (report) => report.classifications),
      browser.report.classifications
    ]
    if (
      Arr.some(classificationReports, (entry) =>
        entry.verified !== baseline.verified || entry.nonmatch !== baseline.nonmatch ||
        entry.invalidInput !== baseline.invalidInput)
    ) {
      return yield* Effect.fail(failure("sign-classification-parity", "runtime classifications differ"))
    }
    const declarations = [
      "import { ed25519Verify, mlDsa65Verify, p256Sha256P1363LowSVerify,",
      "type InvalidVerificationInput, type VerificationUnavailable } from \"@scenesystems/sign\"",
      "import type { Effect } from \"effect\"",
      "type Result = Effect.Effect<boolean, InvalidVerificationInput | VerificationUnavailable, never>",
      "const ed: (s: Uint8Array, m: Uint8Array, k: Uint8Array) => Result = ed25519Verify",
      "const p: (s: Uint8Array, m: Uint8Array, k: Uint8Array) => Result = p256Sha256P1363LowSVerify",
      "const ml: (s: Uint8Array, m: Uint8Array, k: Uint8Array, c: Uint8Array) => Result = mlDsa65Verify",
      "void [ed, p, ml]",
      ""
    ].join("\n")
    yield* fileSystem.writeFileString(path.join(consumer, "consumer.ts"), declarations)
    yield* runCommand("sign-packed-nodenext", consumer, path.join(workspace, "node_modules/.bin/tsc"), [
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "false",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "consumer.ts"
    ])
    const esmExports = yield* runCommand("sign-esm-exports", consumer, "node", [
      "--input-type=module",
      "-e",
      "import * as api from '@scenesystems/sign';process.stdout.write(JSON.stringify(Object.keys(api).sort()))"
    ])
    const cjsExports = yield* runCommand("sign-cjs-exports", consumer, "node", [
      "-e",
      "process.stdout.write(JSON.stringify(Object.keys(require('@scenesystems/sign')).sort()))"
    ])
    if (esmExports !== cjsExports) {
      return yield* Effect.fail(failure("sign-export-parity", "ESM and CJS differ"))
    }
    const denied = yield* Effect.forEach([
      "import('@scenesystems/sign/internal/x')",
      "require('@scenesystems/sign/internal/x')"
    ], (source) =>
      runCommandExit(consumer, "node", ["-e", source]))
    if (
      Arr.some(denied, ({ exitCode }) =>
        exitCode === 0)
    ) {
      return yield* Effect.fail(failure("sign-private-export", "resolved"))
    }
    const tarballSha256 = yield* readSha256Hex(tarball)
    const evidenceRoot = path.join(workspace, ".tmp/crypto-release-evidence")
    yield* fileSystem.makeDirectory(evidenceRoot, { recursive: true })
    const evidence = {
      format: "@scenesystems/sign-release-evidence-v1",
      descriptorFingerprint: descriptor.fingerprint,
      package: { name: PACKAGE_NAME, version: descriptor.body.packageVersion, tarballSha256 },
      reports,
      browser,
      declarations: "strict NodeNext; skipLibCheck false",
      exports: "ESM/CJS parity",
      responsiveness: "one synchronous indivisible primitive; scheduler block is each reported operation duration",
      privateSubpaths: "denied"
    }
    yield* fileSystem.writeFileString(path.join(evidenceRoot, "sign.json"), `${yield* renderCanonical(evidence)}\n`)
    const binding = {
      format: "@scenesystems/sign-package-verifier-binding-v1",
      package: PACKAGE_NAME,
      version: descriptor.body.packageVersion,
      tarballSha256,
      verifierFingerprint: descriptor.fingerprint
    }
    yield* fileSystem.writeFileString(
      path.join(evidenceRoot, "sign-package-verifier-attestation.json"),
      `${yield* renderCanonical(binding)}\n`
    )
    yield* fileSystem.copyFile(tarball, path.join(evidenceRoot, "sign.tgz"))
    yield* Console.log(
      `[crypto:release:sign] qualified ${
        String(descriptor.body.corpus.totalCases)
      } cases in Node, Bun, and ${browser.chromium}`
    )
  }).pipe(Effect.scoped)

const program = Effect.gen(function*() {
  const workspace = yield* root
  const path = yield* Path.Path
  yield* decodeFile(path.join(workspace, PACKAGE_DIRECTORY, "package.json"), ManifestJson)
  if (process.argv.includes("--embed")) return yield* embed(workspace)
  if (process.argv.includes("--require-packed-manifest")) return yield* qualify(workspace)
  yield* Console.log("[publish:check] sign source manifest passed")
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
