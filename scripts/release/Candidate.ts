/** Immutable staging evidence and independent package-publication gates. */
import { FileSystem, Path } from "@effect/platform"
import * as Digest from "@scenesystems/digest/Digest"
import { Array, Boolean, Effect, Encoding, Option, Order, Schema, String, Struct } from "effect"
import * as Npm from "./Npm.js"
import * as Repository from "./Repository.js"

export const Id = Schema.String.pipe(Schema.pattern(/^[1-9][0-9]*$/), Schema.brand("ReleaseId"))
export type Id = typeof Id.Type
const Package = Schema.Struct({
  name: Repository.Package.fields.name,
  version: Schema.String,
  path: Schema.String.pipe(Schema.pattern(/^packages\/[a-z0-9-]+$/)),
  content: Schema.String.pipe(Schema.pattern(/^[0-9a-f]{64}$/))
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
export const Identity = Record.omit("packages")
const Publication = Schema.Struct({
  ...Record.fields,
  packages: Schema.Array(Schema.Struct({
    ...Package.fields,
    publication: Schema.OptionFromNullOr(Npm.Release)
  }))
})

// Changesets CLI 3's artifact contract. This repository does not tag private packages.
const PackedPlan = Schema.Struct({
  version: Schema.Literal(1),
  plan: Schema.NonEmptyArray(Schema.NonEmptyArray(Schema.Struct({
    kind: Schema.Literal("publish"),
    name: Package.fields.name,
    version: Package.fields.version,
    access: Schema.Literal("public"),
    tag: Schema.NonEmptyString,
    tarball: Schema.Struct({
      path: Schema.String.pipe(Schema.pattern(/^packages\/[a-zA-Z0-9_.+-]+\.tgz$/)),
      integrity: Schema.String.pipe(Schema.startsWith("sha256-"))
    })
  })))
})

export class CandidateError extends Schema.TaggedError<CandidateError>()("CandidateError", {
  message: Schema.String
}) {}

export const read = (file: string) =>
  Effect.flatMap(
    FileSystem.FileSystem,
    (fs) => fs.readFileString(file).pipe(Effect.flatMap(Schema.decode(Schema.parseJson(Record))))
  )

export const write = <A, I>(file: string, schema: Schema.Schema<A, I>, value: A) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const json = yield* Schema.encode(Schema.parseJson(schema, { space: 2 }))(value)
    yield* fs.makeDirectory(path.dirname(file), { recursive: true })
    yield* fs.writeFileString(file, String.concat(json, "\n"))
  })

/** The source package membership and versions cannot be changed by an artifact. */
export const validatePackages = (candidate: Record) =>
  Effect.gen(function*() {
    const declarations = yield* Repository.publicPackages(candidate.sha)
    const Identity = Package.pick("name", "version", "path")
    const order = Order.mapInput(String.Order, (pkg: typeof Identity.Type) => pkg.name)
    const expected = Array.sort(Array.map(declarations, Struct.pick("name", "version", "path")), order)
    const actual = Array.sort(Array.map(candidate.packages, Struct.pick("name", "version", "path")), order)
    yield* Effect.unless(new CandidateError({ message: "Candidate packages do not match its source commit." }), () =>
      Array.getEquivalence(Schema.equivalence(Identity))(expected, actual))
  })

/** Capture only prepared, version-resolved package output from this checkout. */
export const capture = (identity: typeof Identity.Type) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const head = yield* Repository.git("rev-parse", "HEAD").pipe(Effect.map(String.trim))
    yield* Effect.unless(new CandidateError({ message: "Candidate SHA is not the prepared checkout." }), () =>
      String.Equivalence(head, identity.sha))
    const declarations = yield* Repository.publicPackages(identity.sha)
    const packages = yield* Effect.forEach(declarations, (pkg) =>
      Effect.gen(function*() {
        const directory = path.join(pkg.path, "dist")
        const prepared = yield* fs.readFileString(path.join(directory, "package.json")).pipe(
          Effect.flatMap(Schema.decode(Schema.parseJson(Repository.Package)))
        )
        yield* Effect.unless(new CandidateError({ message: String.concat("Stale package output: ", pkg.name) }), () =>
          Boolean.and(String.Equivalence(prepared.name, pkg.name), String.Equivalence(prepared.version, pkg.version)))
        return { ...Struct.pick(pkg, "name", "version", "path"), content: yield* Npm.content(directory) }
      }), { concurrency: 2 })
    return yield* Schema.decodeUnknown(Record)({ ...identity, packages })
  })

export const verifyPrepared = (candidate: Record) =>
  Effect.gen(function*() {
    const current = yield* capture(Struct.omit(candidate, "packages"))
    yield* Effect.unless(
      new CandidateError({ message: "Prepared package content differs from staging. Stage a new candidate." }),
      () => Schema.equivalence(Record)(current, candidate)
    )
  })

/** Check exactly the tarballs Changesets will publish, before the OIDC job can start. */
export const verifyPacked = (candidate: Record, directory: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const plan = yield* fs.readFileString(path.join(directory, "publish-plan.json")).pipe(
      Effect.flatMap(Schema.decode(Schema.parseJson(PackedPlan)))
    )
    yield* Effect.forEach(Array.flatten(plan.plan), (release) =>
      Effect.gen(function*() {
        const expected = yield* Array.findFirst(candidate.packages, (pkg) =>
          Boolean.and(
            String.Equivalence(pkg.name, release.name),
            String.Equivalence(pkg.version, release.version)
          )).pipe(
            Effect.mapError(() =>
              new CandidateError({ message: String.concat("Packed release is outside this candidate: ", release.name) })
            )
          )
        const archive = path.join(directory, release.tarball.path)
        const integrity = yield* fs.readFile(archive).pipe(
          Effect.map((bytes) => Digest.hash("sha256", bytes)),
          Effect.map(Encoding.encodeBase64),
          Effect.map((digest) => String.concat("sha256-", digest))
        )
        yield* Effect.unless(
          new CandidateError({ message: String.concat("Packed tarball integrity mismatch: ", release.name) }),
          () => String.Equivalence(integrity, release.tarball.integrity)
        )
        const content = yield* Npm.archiveContent(archive)
        yield* Effect.unless(
          new CandidateError({ message: String.concat("Packing changed the staged package content: ", release.name) }),
          () => String.Equivalence(content, expected.content)
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
              new CandidateError({
                message: String.concat(
                  pkg.name,
                  " is not published. Publish this candidate before promoting the website."
                )
              }),
              () => requirePublished
            ),
          onSome: (release) =>
            Effect.unless(
              new CandidateError({
                message: String.concat(
                  pkg.name,
                  " already exists on npm with different content. Add a changeset and stage the versioned candidate."
                )
              }),
              () => String.Equivalence(release.content, pkg.content)
            )
        })
        yield* Effect.log("Package publication checked").pipe(
          Effect.annotateLogs({ name: pkg.name, version: pkg.version, published: Option.isSome(publication) })
        )
        return { ...pkg, publication }
      }), { concurrency: 2 })
    yield* write(output, Publication, { ...candidate, packages })
  })
