/** Explicit first-publication policy; normal releases never need a registry token. */
import type { Redacted } from "effect"
import { Array, Boolean, Effect, Number, Option, Schema, String } from "effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Candidate from "./Candidate.js"
import * as Npm from "./Npm.js"
import * as Repository from "./Repository.js"

export const Names = Schema.NonEmptyArray(Repository.Package.fields.name)

const select = Effect.fnUntraced(function*(candidate: Candidate.Record, names: ReadonlyArray<string>) {
  const packages = Array.filter(candidate.packages, (pkg) => Array.contains(names, pkg.name))
  yield* Effect.when(
    new Npm.PublicationError({ message: "Select unique, nonempty package names from the staged candidate." }),
    Effect.sync(() =>
      Boolean.not(Boolean.every([
        Array.isReadonlyArrayNonEmpty(names),
        Number.Equivalence(Array.length(names), Array.length(Array.dedupe(names))),
        Number.Equivalence(Array.length(names), Array.length(packages))
      ]))
    )
  )
  return packages
})

export const requireNew = Effect.fnUntraced(function*(
  candidate: Candidate.Record,
  names: ReadonlyArray<string>,
  token: Option.Option<Redacted.Redacted> = Option.none()
) {
  const packages = yield* select(candidate, names)
  yield* Effect.forEach(packages, (pkg) => Npm.requireNew(pkg.name, token), { discard: true })
  return packages
})

const readPlan = Effect.fnUntraced(function*(directory: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  return yield* fs.readFileString(path.join(directory, "publish-plan.json")).pipe(
    Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Candidate.PackedPlan)))
  )
})

/** Exact membership matters: never allow another package to ride along with the bootstrap token. */
export const verifyPacked = Effect.fnUntraced(
  function*(candidate: Candidate.Record, names: ReadonlyArray<string>, directory: string) {
    yield* select(candidate, names)
    const plan = yield* readPlan(directory)
    const releases = Array.flatten(plan.plan)
    yield* Effect.when(
      new Npm.PublicationError({
        message: "Bootstrap plan must publish exactly the selected names once, with the latest tag."
      }),
      Effect.sync(() =>
        Boolean.not(Boolean.every([
          Number.Equivalence(Array.length(releases), Array.length(names)),
          Number.Equivalence(
            Array.length(Array.dedupe(Array.map(releases, (release) => release.name))),
            Array.length(names)
          ),
          Array.every(releases, (release) =>
            Boolean.and(Array.contains(names, release.name), String.Equivalence(release.tag, "latest")))
        ]))
      )
    )
    yield* Candidate.verifyPacked(candidate, directory)
  }
)

/** Preserve Changesets dependency ordering and tarball bytes, while removing every unselected release. */
export const pack = Effect.fnUntraced(
  function*(candidate: Candidate.Record, names: ReadonlyArray<string>, source: string, destination: string) {
    yield* select(candidate, names)
    const original = yield* readPlan(source)
    const plan = yield* Schema.decodeUnknownEffect(Candidate.PackedPlan)({
      ...original,
      plan: Array.filter(
        Array.map(original.plan, (chunk) => Array.filter(chunk, (release) => Array.contains(names, release.name))),
        Array.isArrayNonEmpty
      )
    })
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    // An existing output could contain unrelated tarballs; never reuse it.
    yield* fs.makeDirectory(destination)
    yield* fs.makeDirectory(path.join(destination, "packages"))
    yield* Effect.forEach(
      Array.flatten(plan.plan),
      (release) => fs.copyFile(path.join(source, release.tarball.path), path.join(destination, release.tarball.path)),
      { discard: true }
    )
    yield* Candidate.write(path.join(destination, "publish-plan.json"), Candidate.PackedPlan, plan)
    yield* verifyPacked(candidate, names, destination)
  }
)

/** Check only the first publications; the rest of this candidate belongs to the normal workflow. */
export const verifyPublication = Effect.fnUntraced(function*(
  candidate: Candidate.Record,
  names: ReadonlyArray<string>,
  repository: string,
  output: string
) {
  const selected = yield* select(candidate, names)
  const packages = yield* Effect.forEach(selected, (pkg) =>
    Effect.gen(function*() {
      const release = yield* Npm.published(pkg.name, pkg.version, repository).pipe(
        Effect.flatMap(
          Effect.fromOption(() =>
            new Npm.PublicationError({ message: String.concat("Bootstrap publication is missing: ", pkg.name) })
          )
        )
      )
      yield* Effect.when(
        new Npm.PublicationError({
          message: String.concat("Bootstrap content or provenance commit differs from the candidate: ", pkg.name)
        }),
        Effect.sync(() =>
          Boolean.not(
            Boolean.and(
              String.Equivalence(release.content, pkg.content),
              String.Equivalence(release.sha, candidate.sha)
            )
          )
        )
      )
      return { ...pkg, publication: Option.some(release) }
    }))
  yield* Candidate.write(output, Candidate.Publication, { ...candidate, packages })
})
