import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Digest from "@scenesystems/digest/Digest"
import { Array, Effect, Match, Option, Redacted, Ref, Schema, String } from "effect"
import { Base64 } from "effect/encoding"
import * as FileSystem from "effect/FileSystem"
import { Headers, HttpClient, HttpClientResponse, HttpServerResponse } from "effect/http"
import * as Path from "effect/Path"
import { ChildProcess } from "effect/process"
import * as Bootstrap from "./Bootstrap.js"
import * as Candidate from "./Candidate.js"
import * as Npm from "./Npm.js"
import * as Process from "./Process.js"

const candidate = Schema.decodeSync(Candidate.Record)({
  schema: 2,
  sha: "1111111111111111111111111111111111111111",
  run_id: "12",
  run_attempt: "1",
  artifact_id: "21",
  package_artifact_id: "22",
  packages: [
    { name: "@scenesystems/digest", version: "0.7.0", path: "packages/digest", content: String.repeat(64)("a") },
    {
      name: "@scenesystems/effect-study",
      version: "0.1.0",
      path: "packages/effect-study",
      content: String.repeat(64)("b")
    }
  ]
})

describe("bootstrap publication admission", () => {
  it.effect("admits only the explicitly selected new package and queries the package root", () =>
    Effect.gen(function*() {
      const requests = yield* Ref.make(Array.empty<string>())
      const client = HttpClient.make((request) =>
        Ref.update(requests, Array.append(request.url)).pipe(Effect.as(HttpClientResponse.fromWeb(
          request,
          HttpServerResponse.toWeb(HttpServerResponse.empty({ status: 404 }))
        )))
      )
      const selected = yield* Bootstrap.requireNew(candidate, ["@scenesystems/effect-study"]).pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      )
      expect(Array.map(selected, (pkg) => pkg.name)).toEqual(["@scenesystems/effect-study"])
      expect(yield* Ref.get(requests)).toEqual(["https://registry.npmjs.org/@scenesystems%2Feffect-study"])
    }))

  it.effect("rejects an empty, duplicate, or out-of-candidate selection before contacting npm", () =>
    Effect.gen(function*() {
      const requests = yield* Ref.make(0)
      const client = HttpClient.make((request) =>
        Ref.update(requests, (n) => n + 1).pipe(
          Effect.as(
            HttpClientResponse.fromWeb(request, HttpServerResponse.toWeb(HttpServerResponse.empty({ status: 404 })))
          )
        )
      )
      yield* Effect.forEach([
        [],
        ["@scenesystems/effect-study", "@scenesystems/effect-study"],
        ["@scenesystems/not-in-candidate"]
      ], (names) =>
        Bootstrap.requireNew(candidate, names).pipe(
          Effect.provideService(HttpClient.HttpClient, client),
          Effect.flip
        ))
      expect(yield* Ref.get(requests)).toBe(0)
    }))

  it.effect("fails closed for existing packages and registry errors, not just existing versions", () =>
    Effect.forEach([200, 401, 403, 429, 500], (status) =>
      Effect.gen(function*() {
        const client = HttpClient.make((request) =>
          Effect.succeed(HttpClientResponse.fromWeb(
            request,
            HttpServerResponse.toWeb(HttpServerResponse.empty({ status }))
          ))
        )
        const failure = yield* Bootstrap.requireNew(candidate, ["@scenesystems/effect-study"]).pipe(
          Effect.provideService(HttpClient.HttpClient, client),
          Effect.flip
        )
        expect(failure._tag).toBe("PublicationError")
      })))

  it.effect("rejects a package created between preparation and publication", () =>
    Effect.gen(function*() {
      const status = yield* Ref.make(404)
      const client = HttpClient.make((request) =>
        Ref.get(status).pipe(Effect.map((status) =>
          HttpClientResponse.fromWeb(request, HttpServerResponse.toWeb(HttpServerResponse.empty({ status })))
        ))
      )
      const admission = Bootstrap.requireNew(candidate, ["@scenesystems/effect-study"]).pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      )
      yield* admission
      yield* Ref.set(status, 200)
      expect((yield* admission.pipe(Effect.flip))._tag).toBe("PublicationError")
    }))

  it.effect("rejects a private package hidden from anonymous registry admission", () =>
    Effect.gen(function*() {
      const client = HttpClient.make((request) =>
        Effect.succeed(HttpClientResponse.fromWeb(
          request,
          HttpServerResponse.toWeb(HttpServerResponse.empty({
            status: Option.isSome(Headers.get(request.headers, "authorization")) ? 200 : 404
          }))
        ))
      )
      yield* Bootstrap.requireNew(candidate, ["@scenesystems/effect-study"]).pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      )
      const failure = yield* Bootstrap.requireNew(
        candidate,
        ["@scenesystems/effect-study"],
        Option.some(Redacted.make("test-only-credential"))
      ).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
        Effect.flip
      )
      expect(failure._tag).toBe("PublicationError")
    }))
})

describe("bootstrap tarball selection", () => {
  it.effect("copies only selected verified tarballs and rejects content changed after staging", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* fs.makeTempDirectoryScoped()
      const source = path.join(root, "source")
      const destination = path.join(root, "selected")
      const packageDirectory = path.join(root, "package")
      yield* fs.makeDirectory(path.join(source, "packages"), { recursive: true })
      yield* fs.makeDirectory(packageDirectory)
      yield* fs.writeFileString(path.join(packageDirectory, "index.js"), "export const value = 7\n")
      const content = yield* Npm.content(packageDirectory)
      const staged = yield* Schema.decodeEffect(Candidate.Record)({
        ...candidate,
        packages: Array.map(candidate.packages, (pkg) => ({ ...pkg, content }))
      })
      const archive = path.join(source, "packages/study.tgz")
      yield* Process.output(ChildProcess.make("tar", ["-czf", archive, "-C", root, "package"]))
      const integrity = yield* fs.readFile(archive).pipe(
        Effect.flatMap((bytes) => Digest.hash("sha256", bytes)),
        Effect.flatMap(Schema.encodeEffect(Schema.Uint8ArrayFromBase64)),
        Effect.map((hash) => String.concat("sha256-", hash))
      )
      yield* Candidate.write(path.join(source, "publish-plan.json"), Candidate.PackedPlan, {
        version: 1,
        plan: [[
          {
            kind: "publish",
            name: "@scenesystems/digest",
            version: "0.7.0",
            access: "public",
            tag: "latest",
            tarball: { path: "packages/digest.tgz", integrity }
          },
          {
            kind: "publish",
            name: "@scenesystems/effect-study",
            version: "0.1.0",
            access: "public",
            tag: "latest",
            tarball: { path: "packages/study.tgz", integrity }
          }
        ]]
      })
      yield* Bootstrap.pack(staged, ["@scenesystems/effect-study"], source, destination)
      expect(yield* fs.readDirectory(path.join(destination, "packages"))).toEqual(["study.tgz"])
      yield* Bootstrap.verifyPacked(staged, ["@scenesystems/effect-study"], destination)
      yield* fs.writeFileString(path.join(destination, "packages/study.tgz"), "changed")
      const failure = yield* Bootstrap.verifyPacked(staged, ["@scenesystems/effect-study"], destination).pipe(
        Effect.flip
      )
      expect(failure).toMatchObject({ message: "Packed tarball integrity mismatch: @scenesystems/effect-study" })
      yield* Bootstrap.verifyPacked(staged, ["@scenesystems/digest"], destination).pipe(Effect.flip)
      yield* fs.copyFile(archive, path.join(destination, "packages/study.tgz"))
      const differentContent = yield* Bootstrap.verifyPacked(candidate, ["@scenesystems/effect-study"], destination)
        .pipe(Effect.flip)
      expect(differentContent).toMatchObject({
        message: "Packing changed the staged package content: @scenesystems/effect-study"
      })
      const release = {
        kind: "publish",
        name: "@scenesystems/effect-study",
        version: "0.1.0",
        access: "public",
        tag: "latest",
        tarball: { path: "packages/study.tgz", integrity }
      }
      yield* Effect.forEach([
        [[release, release]],
        [[{ ...release, name: "@scenesystems/digest", version: "0.7.0" }]],
        [[{ ...release, tag: "next" }]],
        [[{ ...release, version: "0.2.0" }]]
      ], (plan) =>
        Effect.gen(function*() {
          const decoded = yield* Schema.decodeUnknownEffect(Candidate.PackedPlan)({ version: 1, plan })
          yield* Candidate.write(path.join(destination, "publish-plan.json"), Candidate.PackedPlan, decoded)
          yield* Bootstrap.verifyPacked(staged, ["@scenesystems/effect-study"], destination).pipe(Effect.flip)
        }))
    }).pipe(Effect.scoped, Effect.provide(BunServices.layer)))
})

describe("bootstrap publication evidence", () => {
  it.effect("requires selected content and commit from an approved publisher, without requiring other candidate packages", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* fs.makeTempDirectoryScoped()
      const directory = path.join(root, "package")
      yield* fs.makeDirectory(directory)
      yield* fs.writeFileString(path.join(directory, "index.js"), "export const value = 9\n")
      const content = yield* Npm.content(directory)
      const staged = yield* Schema.decodeEffect(Candidate.Record)({
        ...candidate,
        packages: Array.map(candidate.packages, (pkg) => ({ ...pkg, content }))
      })
      const archive = path.join(root, "package.tgz")
      yield* Process.output(ChildProcess.make("tar", ["-czf", archive, "-C", root, "package"]))
      const bytes = yield* fs.readFile(archive)
      const sha512 = yield* Process.output(ChildProcess.make("sha512sum", [archive])).pipe(
        Effect.map(String.slice(0, 128))
      )
      const hash = yield* Schema.decodeEffect(Schema.Uint8ArrayFromHex)(sha512)
      const metadata = {
        name: "@scenesystems/effect-study",
        version: "0.1.0",
        dist: {
          integrity: String.concat("sha512-", Base64.encode(hash)),
          tarball: "https://registry.npmjs.org/study.tgz",
          attestations: { url: "https://registry.npmjs.org/attestations" }
        }
      }
      const valid = {
        workflow: ".github/workflows/bootstrap.yml",
        repository: "https://github.com/scenesystems/theoria",
        sha: candidate.sha,
        digest: sha512,
        content,
        status: 200,
        accepted: true
      }
      yield* Effect.forEach([
        valid,
        { ...valid, workflow: ".github/workflows/publish.yml" },
        { ...valid, workflow: ".github/workflows/unrelated.yml", accepted: false },
        { ...valid, repository: "https://github.com/other/theoria", accepted: false },
        { ...valid, sha: String.repeat(40)("2"), accepted: false },
        { ...valid, digest: String.repeat(128)("0"), accepted: false },
        { ...valid, content: String.repeat(64)("0"), accepted: false },
        { ...valid, status: 404, accepted: false }
      ], (testCase) =>
        Effect.gen(function*() {
          const payload = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            subject: [{ digest: { sha512: testCase.digest } }],
            predicate: {
              buildDefinition: {
                externalParameters: { workflow: { repository: testCase.repository, path: testCase.workflow } },
                resolvedDependencies: [{
                  uri: "git+https://github.com/scenesystems/theoria@refs/tags/candidate",
                  digest: { gitCommit: testCase.sha }
                }]
              }
            }
          })
          const requests = yield* Ref.make(Array.empty<string>())
          const client = HttpClient.make((request) =>
            Ref.update(requests, Array.append(request.url)).pipe(
              Effect.as(HttpClientResponse.fromWeb(
                request,
                HttpServerResponse.toWeb(
                  Match.value(request.url).pipe(
                    Match.when(
                      "https://registry.npmjs.org/@scenesystems%2Feffect-study/0.1.0",
                      () => HttpServerResponse.jsonUnsafe(metadata, { status: testCase.status })
                    ),
                    Match.when(metadata.dist.attestations.url, () =>
                      HttpServerResponse.jsonUnsafe({
                        attestations: [{
                          predicateType: "https://slsa.dev/provenance/v1",
                          bundle: { dsseEnvelope: { payload: Base64.encode(payload) } }
                        }]
                      })),
                    Match.when(metadata.dist.tarball, () => HttpServerResponse.uint8Array(bytes)),
                    Match.orElse(() => HttpServerResponse.empty({ status: 404 }))
                  )
                )
              ))
            )
          )
          const output = path.join(root, "publication.json")
          const verification = Bootstrap.verifyPublication(
            { ...staged, packages: Array.map(staged.packages, (pkg) => ({ ...pkg, content: testCase.content })) },
            [metadata.name],
            "scenesystems/theoria",
            output
          ).pipe(
            Effect.provideService(HttpClient.HttpClient, client)
          )
          if (testCase.accepted) {
            yield* verification
            const report = yield* fs.readFileString(output).pipe(
              Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Candidate.Publication)))
            )
            expect(Array.map(report.packages, (pkg) => pkg.name)).toEqual([metadata.name])
          } else {
            yield* verification.pipe(Effect.flip)
          }
          expect(Array.some(yield* Ref.get(requests), String.includes("digest"))).toBe(false)
        }))
    }).pipe(Effect.scoped, Effect.provide(BunServices.layer)))
})
