import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { chromium } from "@playwright/test"
import { moduleSpecifiers, parseTypeScript } from "@theoria/source-proof"
import { Array as Arr, Console, Effect, Option, Schema } from "effect"

import { loadDigestReleaseProfile } from "./crypto-release/digest-profile.js"
import {
  type DigestKatProfile as DigestKatProfileType,
  DigestKatProfileJson,
  DigestRuntimeReport,
  type DigestRuntimeReport as DigestRuntimeReportType,
  DigestRuntimeReportJson
} from "./crypto-release/digest-schema.js"
import {
  CryptoReleaseCheckError,
  CryptoReleaseEvidence,
  CryptoReleaseEvidenceJson,
  readSha256Hex,
  runCommand,
  runCommandExit,
  sameStrings
} from "./crypto-release/shared.js"

const rootUrl = new URL("../", import.meta.url)
const EXPECTED_BUN_VERSION = "1.3.9"
const PACKAGE_NAME = "@scenesystems/digest"
const encodeJsString = Schema.encodeSync(Schema.parseJson(Schema.String))

const checkError = (stage: string, detail: string): CryptoReleaseCheckError =>
  new CryptoReleaseCheckError({ stage, detail })

const decodeJson = <A, I>(stage: string, schema: Schema.Schema<A, I>, value: string) =>
  Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError(() => checkError(stage, "runtime returned an invalid report"))
  )

const readRoot = Path.Path.pipe(
  Effect.flatMap((path) => path.fromFileUrl(rootUrl)),
  Effect.mapError(() => checkError("workspace-root", "could not resolve repository root"))
)

const requestedPackage = Effect.gen(function*() {
  const flagIndex = Arr.findFirstIndex(process.argv, (argument) => argument === "--package")
  const packageName = yield* Option.flatMap(flagIndex, (index) => Arr.get(process.argv, index + 1)).pipe(
    Option.match({
      onNone: () => Effect.fail(checkError("arguments", "usage: --package @scenesystems/digest")),
      onSome: Effect.succeed
    })
  )
  if (packageName !== PACKAGE_NAME) {
    return yield* Effect.fail(checkError("arguments", `unsupported crypto release profile: ${packageName}`))
  }
  return packageName
})

const ConsumerManifestJson = Schema.parseJson(
  Schema.Struct({
    name: Schema.NonEmptyString,
    private: Schema.Literal(true),
    type: Schema.Literal("module", "commonjs"),
    dependencies: Schema.Struct({
      "@scenesystems/digest": Schema.NonEmptyString,
      effect: Schema.NonEmptyString
    })
  })
)

const RootManifestJson = Schema.parseJson(
  Schema.Struct({
    devDependencies: Schema.Struct({ effect: Schema.NonEmptyString })
  })
)

const writeConsumerManifest = (directory: string, name: string, type: "module" | "commonjs", tarball: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* readRoot
    const rootManifest = yield* fileSystem.readFileString(path.join(root, "package.json")).pipe(
      Effect.flatMap(Schema.decodeUnknown(RootManifestJson)),
      Effect.mapError(() => checkError("root-manifest", "effect version"))
    )
    const content = yield* Schema.encode(ConsumerManifestJson)({
      name,
      private: true,
      type,
      dependencies: {
        "@scenesystems/digest": `file:${tarball}`,
        effect: rootManifest.devDependencies.effect
      }
    }).pipe(Effect.mapError(() => checkError("consumer-manifest", name)))
    yield* fileSystem.writeFileString(path.join(directory, "package.json"), `${content}\n`).pipe(
      Effect.mapError(() => checkError("consumer-manifest", name))
    )
  })

const installConsumer = (directory: string) =>
  runCommand("install-packed-consumer", directory, "bun", ["install", "--ignore-scripts", "--no-progress"])

const assertRuntimeVersions = (root: string) =>
  Effect.gen(function*() {
    const node = yield* runCommand("node-version", root, "node", ["--version"])
    const bun = yield* runCommand("bun-version", root, "bun", ["--version"])
    const playwright = yield* runCommand("playwright-version", root, "bunx", ["playwright", "--version"])

    if (!node.startsWith("v22.")) {
      return yield* Effect.fail(checkError("node-version", `expected Node 22, received ${node}`))
    }
    if (bun !== EXPECTED_BUN_VERSION) {
      return yield* Effect.fail(
        checkError("bun-version", `expected Bun ${EXPECTED_BUN_VERSION}, received ${bun}`)
      )
    }
    return { node, bun, playwright }
  })

const assertPublicDeclarations = (packageDirectory: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const declarationsRoot = path.join(packageDirectory, "dist/dist/dts")
    const entries = yield* fileSystem.readDirectory(declarationsRoot, { recursive: true }).pipe(
      Effect.mapError(() => checkError("public-declarations", declarationsRoot))
    )
    const declarationFiles = Arr.filter(
      entries,
      (entry) => entry.endsWith(".d.ts") && !entry.startsWith("internal/")
    )
    const providerImports = yield* Effect.forEach(declarationFiles, (entry) =>
      fileSystem.readFileString(path.join(declarationsRoot, entry)).pipe(
        Effect.map((source) =>
          Arr.filter(moduleSpecifiers(parseTypeScript(entry, source)), (specifier) =>
            specifier.startsWith("@noble/"))
        ),
        Effect.mapError(() => checkError("public-declarations", entry))
      ), { concurrency: "unbounded" })
    const leakedImports = Arr.flatten(providerImports)
    if (leakedImports.length > 0) {
      return yield* Effect.fail(checkError("public-declarations", "Noble provider types leaked"))
    }
  })

const assertPublicRoot = (
  directory: string,
  moduleKind: "esm" | "cjs",
  expectedExports: ReadonlyArray<string>
) =>
  Effect.gen(function*() {
    const source = moduleKind === "esm"
      ? `import * as api from ${
        encodeJsString(PACKAGE_NAME)
      }; process.stdout.write(JSON.stringify(Object.keys(api).sort()))`
      : `process.stdout.write(JSON.stringify(Object.keys(require(${encodeJsString(PACKAGE_NAME)})).sort()))`
    const args = moduleKind === "esm"
      ? ["--input-type=module", "--eval", source]
      : ["--input-type=commonjs", "--eval", source]
    const output = yield* runCommand(`packed-${moduleKind}-root`, directory, "node", args)
    const exports = yield* decodeJson(
      `packed-${moduleKind}-root`,
      Schema.parseJson(Schema.Array(Schema.String)),
      output
    )
    if (!sameStrings(exports, expectedExports)) {
      return yield* Effect.fail(checkError(`packed-${moduleKind}-root`, "public exports differ from 0.3.0 snapshot"))
    }
    const internalSource = moduleKind === "esm"
      ? `await import(${encodeJsString(`${PACKAGE_NAME}/internal/jcs`)})`
      : `require(${encodeJsString(`${PACKAGE_NAME}/internal/jcs`)})`
    const internalArgs = moduleKind === "esm"
      ? ["--input-type=module", "--eval", internalSource]
      : ["--input-type=commonjs", "--eval", internalSource]
    const denial = yield* runCommandExit(directory, "node", internalArgs)
    if (denial.exitCode === 0 || !denial.stderr.includes("ERR_PACKAGE_PATH_NOT_EXPORTED")) {
      return yield* Effect.fail(checkError(`packed-${moduleKind}-internal`, "internal subpath resolved"))
    }
  })

const materializeRuntimeProfile = (root: string, esmDirectory: string, profile: DigestKatProfileType) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const profileJson = yield* Schema.encode(DigestKatProfileJson)(profile).pipe(
      Effect.mapError(() => checkError("runtime-kat-profile", "could not encode profile"))
    )
    yield* Effect.forEach(
      ["digest-schema.ts", "digest-runtime.ts"],
      (file) =>
        fileSystem.copyFile(
          path.join(root, "scripts/crypto-release", file),
          path.join(esmDirectory, file)
        ).pipe(Effect.mapError(() => checkError("runtime-kat-source", file))),
      { discard: true }
    )
    yield* fileSystem.writeFileString(
      path.join(esmDirectory, "digest-profile-data.ts"),
      `export default ${profileJson}\n`
    ).pipe(Effect.mapError(() => checkError("runtime-kat-profile", "could not write profile")))
    yield* fileSystem.writeFileString(
      path.join(esmDirectory, "runtime-entry.ts"),
      [
        "import { Effect, Runtime, Schema } from \"effect\"",
        "import profile from \"./digest-profile-data.ts\"",
        "import { DigestRuntimeReportJson } from \"./digest-schema.ts\"",
        "import { runDigestRuntimeProfile } from \"./digest-runtime.ts\"",
        "const program = Effect.flatMap(runDigestRuntimeProfile(profile), Schema.encode(DigestRuntimeReportJson))",
        "process.stdout.write(`${Runtime.runSync(Runtime.defaultRuntime)(program)}\\n`)",
        ""
      ].join("\n")
    ).pipe(Effect.mapError(() => checkError("runtime-kat-source", "runtime-entry.ts")))
    yield* fileSystem.writeFileString(
      path.join(esmDirectory, "browser-entry.ts"),
      [
        "import { Runtime } from \"effect\"",
        "import profile from \"./digest-profile-data.ts\"",
        "import { runDigestRuntimeProfile } from \"./digest-runtime.ts\"",
        "Reflect.set(globalThis, \"__THEORIA_DIGEST_RELEASE_REPORT__\", Runtime.runSync(Runtime.defaultRuntime)(runDigestRuntimeProfile(profile)))",
        ""
      ].join("\n")
    ).pipe(Effect.mapError(() => checkError("runtime-kat-source", "browser-entry.ts")))
  })

const runRuntimeKats = (directory: string, runtime: "node" | "bun") =>
  runCommand(
    `${runtime}-runtime-kats`,
    directory,
    runtime,
    runtime === "node" ? ["--experimental-strip-types", "runtime-entry.ts"] : ["runtime-entry.ts"]
  ).pipe(
    Effect.flatMap((output) => decodeJson(`${runtime}-runtime-kats`, DigestRuntimeReportJson, output))
  )

const playwrightEffect = <A>(stage: string, evaluate: () => Promise<A>) =>
  Effect.tryPromise({
    try: evaluate,
    catch: () => checkError(stage, "Playwright operation failed")
  })

const runBrowserKats = (root: string, directory: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    yield* runCommand("playwright-install", root, "bunx", ["playwright", "install", "chromium"])
    yield* runCommand(
      "browser-bundle",
      directory,
      "bun",
      ["build", "browser-entry.ts", "--target", "browser", "--outfile", "browser-profile.js"]
    )
    const browser = yield* Effect.acquireRelease(
      playwrightEffect("chromium-launch", () => chromium.launch({ headless: true })),
      (browser) => Effect.promise(() => browser.close())
    )
    const page = yield* playwrightEffect("chromium-page", () => browser.newPage())
    yield* playwrightEffect("chromium-content", () =>
      page.setContent("<!doctype html><title>digest release profile</title>"))
    yield* playwrightEffect("chromium-script", () =>
      page.addScriptTag({ path: path.join(directory, "browser-profile.js") }))
    const report = yield* playwrightEffect("chromium-report", () =>
      page.evaluate(() =>
        Reflect.get(globalThis, "__THEORIA_DIGEST_RELEASE_REPORT__")
      ))
    const decoded = yield* Schema.decodeUnknown(DigestRuntimeReport)(report).pipe(
      Effect.mapError(() =>
        checkError("chromium-report", "runtime returned an invalid report")
      )
    )
    return { report: decoded, version: browser.version() }
  }).pipe(Effect.scoped)

const assertSameRuntimeReport = (
  expectedIds: ReadonlyArray<string>,
  reports: ReadonlyArray<DigestRuntimeReportType>
) =>
  Effect.forEach(reports, (report) =>
    report.katCount === expectedIds.length && sameStrings(report.katIds, expectedIds)
      ? Effect.void
      : Effect.fail(checkError("runtime-kat-consistency", "runtime KAT IDs or count drifted")), { discard: true })

const program = Effect.gen(function*() {
  yield* requestedPackage
  const root = yield* readRoot
  const path = yield* Path.Path
  const fileSystem = yield* FileSystem.FileSystem
  const runtimes = yield* assertRuntimeVersions(root)
  const profile = yield* loadDigestReleaseProfile(root)

  yield* runCommand("digest-clean", root, "bun", ["run", "--filter", profile.packageName, "clean"])
  yield* runCommand("digest-build", root, "bun", ["run", "--filter", profile.packageName, "build"])
  yield* runCommand("digest-fixtures", root, "bun", ["run", "--filter", profile.packageName, "fixtures:check"])
  yield* assertPublicDeclarations(profile.packageDirectory)

  const temporaryRoot = yield* fileSystem.makeTempDirectoryScoped({ prefix: "theoria-crypto-release-" }).pipe(
    Effect.mapError(() => checkError("temporary-consumers", "could not create temporary directory"))
  )
  const tarball = path.join(temporaryRoot, "digest.tgz")
  const esmDirectory = path.join(temporaryRoot, "esm-consumer")
  const cjsDirectory = path.join(temporaryRoot, "cjs-consumer")
  yield* fileSystem.makeDirectory(esmDirectory, { recursive: true }).pipe(Effect.orDie)
  yield* fileSystem.makeDirectory(cjsDirectory, { recursive: true }).pipe(Effect.orDie)
  yield* runCommand(
    "pack-digest",
    path.join(profile.packageDirectory, "dist"),
    "bun",
    ["pm", "pack", "--filename", tarball, "--ignore-scripts", "--quiet"]
  )
  const tarballSha256 = yield* readSha256Hex(tarball)

  yield* writeConsumerManifest(esmDirectory, "digest-packed-esm-consumer", "module", tarball)
  yield* writeConsumerManifest(cjsDirectory, "digest-packed-cjs-consumer", "commonjs", tarball)
  yield* installConsumer(esmDirectory)
  yield* installConsumer(cjsDirectory)
  yield* assertPublicRoot(esmDirectory, "esm", profile.expectedExports)
  yield* assertPublicRoot(cjsDirectory, "cjs", profile.expectedExports)
  yield* materializeRuntimeProfile(root, esmDirectory, profile.kats)

  const nodeReport = yield* runRuntimeKats(esmDirectory, "node")
  const bunReport = yield* runRuntimeKats(esmDirectory, "bun")
  const browser = yield* runBrowserKats(root, esmDirectory)
  const expectedKatIds = Arr.map(profile.kats.cases, (kat) => kat.id)
  yield* assertSameRuntimeReport(expectedKatIds, [nodeReport, bunReport, browser.report])

  const gitCommit = yield* runCommand("git-commit", root, "git", ["rev-parse", "HEAD"])
  const workingTreeStatus = yield* runCommand(
    "git-working-tree",
    root,
    "git",
    ["status", "--porcelain", "--untracked-files=all"]
  )
  const lockfileSha256 = yield* readSha256Hex(path.join(root, "bun.lock"))
  const evidence = yield* Schema.decodeUnknown(CryptoReleaseEvidence)({
    format: "theoria-crypto-release-evidence-v1",
    packageName: profile.packageName,
    gitCommit,
    workingTree: workingTreeStatus.length === 0 ? "clean" : "dirty",
    lockfileSha256,
    provider: profile.provider,
    fixtures: profile.fixtures,
    runtimes: { ...runtimes, chromium: browser.version },
    tarballSha256,
    katIds: expectedKatIds,
    verdicts: {
      esm: "pass",
      cjs: "pass",
      node: "pass",
      bun: "pass",
      browser: "pass",
      internalExports: "denied",
      publicDeclarations: "provider-types-absent"
    }
  }).pipe(Effect.mapError(() => checkError("release-evidence", "report fields are invalid")))
  const encodedEvidence = yield* Schema.encode(CryptoReleaseEvidenceJson)(evidence).pipe(
    Effect.mapError(() => checkError("release-evidence", "could not encode report"))
  )
  const evidenceDirectory = path.join(root, ".tmp/crypto-release-evidence")
  const evidencePath = path.join(evidenceDirectory, "digest.json")
  yield* fileSystem.makeDirectory(evidenceDirectory, { recursive: true }).pipe(Effect.orDie)
  yield* fileSystem.writeFileString(evidencePath, `${encodedEvidence}\n`).pipe(Effect.orDie)
  yield* Console.log(
    `[crypto:release:check] digest packed-runtime profile passed (${String(expectedKatIds.length)} KATs)`
  )
  yield* Console.log(`[crypto:release:check] evidence: ${path.relative(root, evidencePath)}`)
}).pipe(Effect.scoped)

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
