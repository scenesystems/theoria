/** Git identities and version-only review carry-forward. No working-tree mutation. */
import { Command } from "@effect/platform"
import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import { Array, Boolean, Effect, HashSet, Number, Option, Order, Record, Schema, String, Tuple } from "effect"
import * as Jsonc from "./Jsonc.js"
import * as Process from "./Process.js"

export const Sha = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{40}$/),
  Schema.brand("@theoria/scripts/release/Repository/ReleaseSha")
)
export type Sha = typeof Sha.Type
export const Manifest = Schema.Record({ key: Schema.String, value: Schema.Unknown })
export type Manifest = typeof Manifest.Type
const Dependencies = Schema.Record({ key: Schema.String, value: Schema.String })
const dependencyFields = Array.make("dependencies", "devDependencies", "peerDependencies", "optionalDependencies")
export const Package = Schema.Struct({
  name: Schema.String.pipe(Schema.pattern(/^@[a-z0-9-]+\/[a-z0-9-]+$/)),
  version: Schema.String,
  private: Schema.optionalWith(Schema.Boolean, { default: () => false })
})

export class RepositoryError extends Schema.TaggedError<RepositoryError>(
  "@theoria/scripts/release/Repository/RepositoryError"
)("RepositoryError", { message: Schema.String }) {}

/** Capture output AND require success: Command.string alone does not check exit status. */
export const git = (...args: Array.NonEmptyReadonlyArray<string>) => Process.output(Command.make("git", ...args))

export const text = (sha: Sha, path: string) => git("show", String.concat(sha, String.concat(":", path)))
const manifest = (sha: Sha, path: string) =>
  text(sha, path).pipe(Effect.flatMap(Schema.decode(Schema.parseJson(Manifest))))

export const packages = (sha: Sha) =>
  Effect.gen(function*() {
    const directories = yield* git("ls-tree", "--name-only", "-d", String.concat(sha, ":packages"))
    return yield* Effect.forEach(
      Array.filter(String.split(String.trim(directories), "\n"), String.isNonEmpty),
      (directory) => {
        const path = String.concat("packages/", directory)
        return manifest(sha, String.concat(path, "/package.json")).pipe(
          Effect.flatMap(Schema.decodeUnknown(Package)),
          Effect.map((value) => ({ ...value, path }))
        )
      }
    )
  })

export const publicPackages = (sha: Sha) =>
  packages(sha).pipe(Effect.map(Array.filter((pkg) => Boolean.not(pkg.private))))

const versions = (sha: Sha) =>
  publicPackages(sha).pipe(
    Effect.map((packages) => Record.fromEntries(Array.map(packages, (pkg) => Tuple.make(pkg.name, pkg.version))))
  )
type Versions = typeof Dependencies.Type
const version = (text: string) =>
  Schema.decode(Schema.String.pipe(Schema.pattern(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/)))(text).pipe(
    Effect.map(String.split(".")),
    Effect.flatMap(
      Schema.decodeUnknown(Schema.Tuple(Schema.NumberFromString, Schema.NumberFromString, Schema.NumberFromString))
    )
  )

const finalize = (before: Manifest, oldVersions: Versions, newVersions: Versions) => {
  const next = Record.get(before, "name").pipe(
    Option.flatMap(Schema.decodeUnknownOption(Schema.String)),
    Option.flatMap((name) => Record.get(newVersions, name)),
    Option.match({ onNone: () => before, onSome: (value) => Record.set(before, "version", value) })
  )
  return Effect.reduce(dependencyFields, next, (current, field) =>
    Option.match(Record.get(current, field), {
      onNone: () => Effect.succeed(current),
      onSome: (input) =>
        Schema.decodeUnknown(Dependencies)(input).pipe(Effect.map((dependencies) =>
          Record.set(
            current,
            field,
            Record.map(dependencies, (range, name) =>
              Option.match(Option.all(Tuple.make(Record.get(oldVersions, name), Record.get(newVersions, name))), {
                onNone: () => range,
                onSome: ([oldVersion, newVersion]) =>
                  Array.findFirst(
                    Array.make("", "^", "~", "workspace:", "workspace:^", "workspace:~"),
                    (prefix) => String.Equivalence(String.concat(prefix, oldVersion), range)
                  ).pipe(Option.match({ onNone: () => range, onSome: (prefix) => String.concat(prefix, newVersion) }))
              }))
          )
        ))
    }))
}

const requireEqual = <A>(before: A, after: A, path: string) =>
  Effect.gen(function*() {
    const values = yield* Effect.all(Tuple.make(CanonicalJson.encode(before), CanonicalJson.encode(after)))
    yield* Effect.unless(
      new RepositoryError({
        message: String.concat("Changes beyond version finalization require a fresh review: ", path)
      }),
      () => String.Equivalence(Tuple.getFirst(values), Tuple.getSecond(values))
    )
  })

/** The complete interval must contain only actual version-finalization edits. */
export const review = (before: Sha, after: Sha) =>
  Effect.gen(function*() {
    yield* git("merge-base", "--is-ancestor", before, after)
    const oldVersions = yield* versions(before)
    const newVersions = yield* versions(after)
    yield* requireEqual(
      Array.sort(Record.keys(oldVersions), String.Order),
      Array.sort(Record.keys(newVersions), String.Order),
      "package membership"
    )
    yield* Effect.forEach(Record.toEntries(oldVersions), ([name, oldValue]) =>
      Effect.gen(function*() {
        const newValue = yield* Record.get(newVersions, name)
        const oldVersion = yield* version(oldValue)
        const newVersion = yield* version(newValue)
        yield* Effect.unless(
          new RepositoryError({ message: "Version downgrades require a fresh review." }),
          () => Order.lessThanOrEqualTo(Order.tuple(Number.Order, Number.Order, Number.Order))(oldVersion, newVersion)
        )
      }))
    const diff = yield* git("diff", "--no-renames", "--name-status", "-z", before, after)
    const changes = Array.chunksOf(Array.filter(String.split(diff, "\0"), String.isNonEmpty), 2)
    yield* Effect.forEach(changes, (change) =>
      Effect.gen(function*() {
        const [status, path] = yield* Schema.decodeUnknown(Schema.Tuple(Schema.String, Schema.String))(change)
        const consumed = Boolean.every(
          Array.make(
            String.Equivalence(status, "D"),
            String.startsWith(".changeset/")(path),
            String.endsWith(".md")(path),
            Boolean.not(String.Equivalence(path, ".changeset/README.md"))
          )
        )
        const changelog = Boolean.and(
          HashSet.has(HashSet.make("A", "M"), status),
          Option.isSome(String.match(/^packages\/[^/]+\/CHANGELOG\.md$/)(path))
        )
        yield* Effect.unless(
          Effect.gen(function*() {
            yield* Effect.unless(
              new RepositoryError({ message: String.concat("Review this candidate directly: ", path) }),
              () => String.Equivalence(status, "M")
            )
            yield* Effect.if(String.Equivalence(path, "bun.lock"), {
              onTrue: () =>
                Effect.gen(function*() {
                  const oldLock = yield* text(before, path).pipe(Effect.flatMap(Schema.decode(Jsonc.parse(Manifest))))
                  const newLock = yield* text(after, path).pipe(Effect.flatMap(Schema.decode(Jsonc.parse(Manifest))))
                  const workspaces = yield* Record.get(oldLock, "workspaces").pipe(
                    Effect.flatMap(Schema.decodeUnknown(Schema.Record({ key: Schema.String, value: Manifest })))
                  )
                  const finalized = yield* Effect.forEach(
                    Record.toEntries(workspaces),
                    ([name, value]) =>
                      finalize(value, oldVersions, newVersions).pipe(Effect.map((value) => Tuple.make(name, value)))
                  )
                  yield* requireEqual(Record.set(oldLock, "workspaces", Record.fromEntries(finalized)), newLock, path)
                }),
              onFalse: () =>
                Effect.gen(function*() {
                  yield* Effect.unless(
                    new RepositoryError({ message: String.concat("Review this candidate directly: ", path) }),
                    () =>
                      Option.isSome(
                        String.match(
                          /^(package\.json|packages\/[^/]+\/package\.json|apps\/[^/]+\/package\.json|scripts\/package\.json)$/
                        )(path)
                      )
                  )
                  const oldManifest = yield* manifest(before, path)
                  const newManifest = yield* manifest(after, path)
                  yield* requireEqual(yield* finalize(oldManifest, oldVersions, newVersions), newManifest, path)
                })
            })
          }),
          () => Boolean.or(consumed, changelog)
        )
      }), { discard: true })
    yield* Effect.log("Version-only successor verified").pipe(Effect.annotateLogs({ before, after }))
  })
