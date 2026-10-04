/** Immutable staging evidence and independent package-publication gates. */
import * as Digest from "@scenesystems/digest/Digest"
import { Array, Boolean, Effect, Option, Order, Schema, String, Struct } from "effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Npm from "./Npm.js"
import * as Repository from "./Repository.js"

export const Id = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[1-9][0-9]*$/)),
  Schema.brand("@theoria/scripts/release/Candidate/ReleaseId")
)
export type Id = typeof Id.Type
const Package = Schema.Struct({
  name: Repository.Package.fields.name,
  version: Schema.String,
  path: Schema.String.pipe(Schema.check(Schema.isPattern(/^packages\/[a-z0-9-]+$/))),
  content: Schema.String.pipe(Schema.check(Schema.isPattern(/^[0-9a-f]{64}$/)))
})
export const Record = Schema.Struct({
  schema: Schema.Literal(2),
  sha: Repository.Sha,
  run_id: Id,
  run_attempt: Id,
  artifact_id: Id,
  package_artifact_id: Id,
  packages: Schema.NonEmptyArray(Package)
})
export type Record = typeof Record.Type
export const Identity = Schema.Struct({
  schema: Record.fields.schema,
  sha: Record.fields.sha,
  run_id: Record.fields.run_id,
  run_attempt: Record.fields.run_attempt,
  artifact_id: Record.fields.artifact_id,
  package_artifact_id: Record.fields.package_artifact_id
})
export const Publication = Schema.Struct({
  ...Record.fields,
  packages: Schema.Array(Schema.Struct({
    ...Package.fields,
    publication: Schema.OptionFromNullOr(Npm.Release)
  }))
})

// Changesets CLI 3's artifact contract. This repository does not tag private packages.
export const PackedPlan = Schema.Struct({
  version: Schema.Literal(1),
  plan: Schema.NonEmptyArray(Schema.NonEmptyArray(Schema.Struct({
    kind: Schema.Literal("publish"),
    name: Package.fields.name,
    version: Package.fields.version,
    access: Schema.Literal("public"),
    tag: Schema.NonEmptyString,
    tarball: Schema.Struct({
      path: Schema.String.pipe(Schema.check(Schema.isPattern(/^packages\/[a-zA-Z0-9_.+-]+\.tgz$/))),
      integrity: Schema.String.pipe(Schema.check(Schema.isStartingWith("sha256-")))
    })
  })))
})

export class CandidateError
  extends Schema.TaggedError<CandidateError>("@theoria/scripts/release/Candidate/CandidateError")("CandidateError", {
    message: Schema.String
  })
{}

export const read = (file: string) =>
  Effect.flatMap(
    FileSystem.FileSystem,
    (fs) => fs.readFileString(file).pipe(Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Record))))
  )

export const write = <S extends Schema.ConstraintCodec<unknown, unknown, never, never>>(
  file: string,
  schema: S,
  value: S["Type"]
) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const json = yield* Schema.encodeEffect(Schema.fromJsonString(schema, { space: 2 }))(value)
    yield* fs.makeDirectory(path.dirname(file), { recursive: true })
    yield* fs.writeFileString(file, String.concat(json, "\n"))
  })

/** The source package membership and versions cannot be changed by an artifact. */
export const validatePackages = (candidate: Record) =>
  Effect.gen(function*() {
    const declarations = yield* Repository.publicPackages(candidate.sha)
    const Identity = Schema.Struct({
      name: Package.fields.name,
      version: Package.fields.version,
      path: Package.fields.path
    })
    const order = Order.mapInput(String.Order, (pkg: typeof Identity.Type) => pkg.name)
    const expected = Array.sort(Array.map(declarations, Struct.pick(["name", "version", "path"])), order)
    const actual = Array.sort(Array.map(candidate.packages, Struct.pick(["name", "version", "path"])), order)
    yield* Effect.when(
      new CandidateError({ message: "Candidate packages do not match its source commit." }),
      Effect.sync(() => Boolean.not(Array.makeEquivalence(Schema.toEquivalence(Identity))(expected, actual)))
    )
  })

/** Capture only prepared, version-resolved package output from this checkout. */
export const capture = (identity: typeof Identity.Type) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const head = yield* Repository.git("rev-parse", "HEAD").pipe(Effect.map(String.trim))
    yield* Effect.when(
      new CandidateError({ message: "Candidate SHA is not the prepared checkout." }),
      Effect.sync(() => Boolean.not(String.Equivalence(head, identity.sha)))
    )
    const declarations = yield* Repository.publicPackages(identity.sha)
    const packages = yield* Effect.forEach(declarations, (pkg) =>
      Effect.gen(function*() {
        const directory = path.join(pkg.path, "dist")
        const prepared = yield* fs.readFileString(path.join(directory, "package.json")).pipe(
          Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Repository.Package)))
        )
        yield* Effect.when(
          new CandidateError({ message: String.concat("Stale package output: ", pkg.name) }),
          Effect.sync(() =>
            Boolean.not(
              Boolean.and(
                String.Equivalence(prepared.name, pkg.name),
                String.Equivalence(prepared.version, pkg.version)
              )
            )
          )
        )
        return { ...Struct.pick(pkg, ["name", "version", "path"]), content: yield* Npm.content(directory) }
      }), { concurrency: 2 })
    return yield* Schema.decodeUnknownEffect(Record)({ ...identity, packages })
  })

export const verifyPrepared = (candidate: Record) =>
  Effect.gen(function*() {
    const current = yield* capture(Struct.omit(candidate, ["packages"]))
    yield* Effect.when(
      new CandidateError({ message: "Prepared package content differs from staging. Stage a new candidate." }),
      Effect.sync(() => Boolean.not(Schema.toEquivalence(Record)(current, candidate)))
    )
  })

/** Check exactly the tarballs Changesets will publish, before the OIDC job can start. */
export const verifyPacked = (candidate: Record, directory: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const plan = yield* fs.readFileString(path.join(directory, "publish-plan.json")).pipe(
      Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(PackedPlan)))
    )
    yield* Effect.forEach(Array.flatten(plan.plan), (release) =>
      Effect.gen(function*() {
        const expected = yield* Effect.fromOption(
          Array.findFirst(candidate.packages, (pkg) =>
            Boolean.and(
              String.Equivalence(pkg.name, release.name),
              String.Equivalence(pkg.version, release.version)
            )),
          () =>
            new CandidateError({
              message: String.concat("Packed release is outside this candidate: ", release.name)
            })
        )
        const archive = path.join(directory, release.tarball.path)
        const integrity = yield* fs.readFile(archive).pipe(
          Effect.flatMap((bytes) => Digest.hash("sha256", bytes)),
          Effect.flatMap(Schema.encodeEffect(Schema.Uint8ArrayFromBase64)),
          Effect.map((digest) => String.concat("sha256-", digest))
        )
        yield* Effect.when(
          new CandidateError({ message: String.concat("Packed tarball integrity mismatch: ", release.name) }),
          Effect.sync(() => Boolean.not(String.Equivalence(integrity, release.tarball.integrity)))
        )
        const content = yield* Npm.archiveContent(archive)
        yield* Effect.when(
          new CandidateError({ message: String.concat("Packing changed the staged package content: ", release.name) }),
          Effect.sync(() => Boolean.not(String.Equivalence(content, expected.content)))
        )
        yield* Effect.log("Packed tarball matches staging").pipe(
          Effect.annotateLogs({ name: release.name, version: release.version })
        )
      }), { concurrency: 2, discard: true })
  })

/** Existing npm versions must match; production additionally requires every version to exist. */
export const verifyPublication = (candidate: Record, repository: string, requirePublished: boolean, output: string) =>
  Effect.gen(function*() {
    yield* validatePackages(candidate)
    const packages = yield* Effect.forEach(candidate.packages, (pkg) =>
      Effect.gen(function*() {
        const publication = yield* Npm.published(pkg.name, pkg.version, repository)
        yield* Option.match(publication, {
          onNone: () =>
            Effect.when(
              Effect.fail(
                new CandidateError({
                  message: String.concat(
                    pkg.name,
                    " is not published. Publish this candidate before promoting the website."
                  )
                })
              ),
              Effect.succeed(requirePublished)
            ),
          onSome: (release) =>
            Effect.when(
              new CandidateError({
                message: String.concat(
                  pkg.name,
                  " already exists on npm with different content. Add a changeset and stage the versioned candidate."
                )
              }),
              Effect.sync(() => Boolean.not(String.Equivalence(release.content, pkg.content)))
            )
        })
        yield* Effect.log("Package publication checked").pipe(
          Effect.annotateLogs({ name: pkg.name, version: pkg.version, published: Option.isSome(publication) })
        )
        return { ...pkg, publication }
      }), { concurrency: 2 })
    yield* write(output, Publication, { ...candidate, packages })
  })
