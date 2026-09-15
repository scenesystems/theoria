/** Compare prepared package content with the actual npm release, not guessed build inputs. */
import { Command, FileSystem, HttpClient, HttpClientRequest, Path } from "@effect/platform"
import { digestCanonicalJsonHex, sha256, toHex } from "@scenesystems/digest"
import {
  Array,
  Boolean,
  Effect,
  Encoding,
  HashSet,
  Match,
  Number,
  Option,
  Record,
  Schema,
  Stream,
  String,
  Tuple
} from "effect"
import * as Process from "./Process.js"
import * as Repository from "./Repository.js"

export class PublicationError extends Schema.TaggedError<PublicationError>()("PublicationError", {
  message: Schema.String
}) {}

export const Release = Schema.Struct({
  sha: Repository.Sha,
  integrity: Schema.String,
  content: Schema.String
})

const RegistryUrl = Schema.String.pipe(Schema.startsWith("https://registry.npmjs.org/"))
const Metadata = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  dist: Schema.Struct({
    tarball: RegistryUrl,
    integrity: Schema.String.pipe(Schema.startsWith("sha512-")),
    attestations: Schema.Struct({ url: RegistryUrl })
  })
})
const Attestations = Schema.Struct({
  attestations: Schema.Array(Schema.Struct({
    predicateType: Schema.String,
    bundle: Schema.Struct({ dsseEnvelope: Schema.Struct({ payload: Schema.String }) })
  }))
})
const Provenance = Schema.Struct({
  subject: Schema.Array(Schema.Struct({ digest: Schema.Struct({ sha512: Schema.String }) })),
  predicate: Schema.Struct({
    buildDefinition: Schema.Struct({
      externalParameters: Schema.Struct({
        workflow: Schema.Struct({ repository: Schema.String, path: Schema.String })
      }),
      resolvedDependencies: Schema.Array(
        Schema.Struct({ uri: Schema.String, digest: Schema.Struct({ gitCommit: Repository.Sha }) })
      )
    })
  })
})

const request = (url: string) =>
  Effect.flatMap(HttpClient.HttpClient, (client) => HttpClient.withScope(client).execute(HttpClientRequest.get(url)))
const requireSuccess = (status: number) =>
  Effect.unless(
    new PublicationError({
      message: String.concat("npm returned HTTP ", Schema.encodeSync(Schema.NumberFromString)(status))
    }),
    () => Number.Equivalence(status, 200)
  )

/** Ordered file-content identity. Root README/changelog and descriptive manifest metadata are not runtime inputs. */
export const content = (directory: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.realPath(directory)
    const names = yield* fs.readDirectory(root, { recursive: true })
    const files = yield* Effect.forEach(Array.sort(names, String.Order), (name) =>
      Effect.gen(function*() {
        const file = path.join(root, name)
        const real = yield* fs.realPath(file)
        yield* Effect.unless(
          new PublicationError({ message: String.concat("Package contains a symbolic link: ", file) }),
          () => String.Equivalence(real, file)
        )
        const info = yield* fs.stat(file)
        return yield* Match.value(info.type).pipe(
          Match.when("Directory", () => Effect.succeedNone),
          Match.when("File", () =>
            Effect.if(Boolean.or(String.Equivalence(name, "README.md"), String.Equivalence(name, "CHANGELOG.md")), {
              onTrue: () => Effect.succeedNone,
              onFalse: () =>
                Effect.gen(function*() {
                  const digest = yield* Effect.if(String.Equivalence(name, "package.json"), {
                    onTrue: () =>
                      fs.readFileString(file).pipe(
                        Effect.flatMap(Schema.decode(Schema.parseJson(Repository.Manifest))),
                        Effect.map(Record.filter((_value, key) =>
                          Boolean.not(
                            HashSet.has(HashSet.make("description", "homepage", "repository", "bugs", "keywords"), key)
                          )
                        )),
                        Effect.flatMap((manifest) => digestCanonicalJsonHex("sha256", manifest))
                      ),
                    onFalse: () => fs.readFile(file).pipe(Effect.flatMap(sha256), Effect.map(toHex))
                  })
                  return Option.some(Tuple.make(name, digest))
                })
            })),
          Match.whenOr("SymbolicLink", "BlockDevice", "CharacterDevice", "FIFO", "Socket", "Unknown", () =>
            Effect.fail(
              new PublicationError({ message: String.concat("Package contains a non-regular file: ", file) })
            )),
          Match.exhaustive
        )
      }), { concurrency: 8 })
    return yield* digestCanonicalJsonHex("sha256", Array.getSomes(files))
  })

/** npm's registry-hosted provenance binds the tarball metadata to this repository and publishing workflow. */
const source = (metadata: typeof Metadata.Type, repository: string) =>
  Effect.gen(function*() {
    const response = yield* request(metadata.dist.attestations.url)
    yield* requireSuccess(response.status)
    const attestations = yield* response.json.pipe(Effect.flatMap(Schema.decodeUnknown(Attestations)))
    const digest = yield* Encoding.decodeBase64(String.slice(7)(metadata.dist.integrity)).pipe(
      Effect.map(Encoding.encodeHex)
    )
    const statements = yield* Effect.forEach(
      Array.filter(attestations.attestations, (entry) =>
        String.Equivalence(entry.predicateType, "https://slsa.dev/provenance/v1")),
      (entry) =>
        Encoding.decodeBase64String(entry.bundle.dsseEnvelope.payload).pipe(
          Effect.flatMap(Schema.decode(Schema.parseJson(Provenance)))
        )
    )
    const expectedRepository = String.concat("https://github.com/", repository)
    const commits = Array.dedupe(Array.flatMap(statements, (statement) => {
      const definition = statement.predicate.buildDefinition
      return Boolean.match(
        Boolean.every(Array.make(
          Array.some(statement.subject, (subject) =>
            String.Equivalence(subject.digest.sha512, digest)),
          String.Equivalence(definition.externalParameters.workflow.repository, expectedRepository),
          String.Equivalence(definition.externalParameters.workflow.path, ".github/workflows/publish.yml")
        )),
        {
          onFalse: () => Array.empty<Repository.Sha>(),
          onTrue: () =>
            Array.map(
              Array.filter(
                definition.resolvedDependencies,
                (dependency) =>
                  String.startsWith(String.concat("git+", String.concat(expectedRepository, "@")))(dependency.uri)
              ),
              (dependency) => dependency.digest.gitCommit
            )
        }
      )
    }))
    const [sha] = yield* Schema.decodeUnknown(Schema.Tuple(Repository.Sha))(commits)
    return sha
  })

/** The same archive policy applies before publication and when reading npm. */
export const archiveContent = (archive: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped()
    const members = yield* Process.output(Command.make("tar", "-tzf", archive)).pipe(
      Effect.map(String.linesIterator),
      Effect.map(Array.fromIterable)
    )
    yield* Effect.unless(new PublicationError({ message: "Package tarball contains unsafe or duplicate paths." }), () =>
      Boolean.every(Array.make(
        Number.Equivalence(Array.length(members), HashSet.size(HashSet.fromIterable(members))),
        Array.every(members, (member) =>
          Boolean.and(
            Option.isSome(String.match(/^package\/[a-zA-Z0-9_@+./-]*$/)(member)),
            Boolean.not(Array.some(String.split(member, "/"), (part) =>
              Boolean.or(String.Equivalence(part, "."), String.Equivalence(part, ".."))))
          ))
      )))
    const listing = yield* Process.output(Command.make("tar", "-tvzf", archive)).pipe(
      Effect.map(String.linesIterator),
      Effect.map(Array.fromIterable)
    )
    yield* Effect.unless(new PublicationError({ message: "Package tarball contains links or special files." }), () =>
      Array.every(listing, (line) =>
        Boolean.or(String.startsWith("-")(line), String.startsWith("d")(line))))
    yield* Process.output(
      Command.make(
        "tar",
        "--extract",
        "--gzip",
        "--file",
        archive,
        "--directory",
        directory,
        "--no-same-owner",
        "--no-same-permissions"
      )
    )
    return yield* content(path.join(directory, "package"))
  }).pipe(Effect.scoped, Effect.timeout("1 minute"))

/** Absent versions are distinct from registry failures. Downloaded archives are scoped and never executed. */
export const published = (name: string, version: string, repository: string) =>
  Effect.gen(function*() {
    const url = Array.join(
      Array.make("https://registry.npmjs.org/", String.replaceAll("/", "%2F")(name), "/", version),
      ""
    )
    const response = yield* request(url)
    return yield* Effect.if(Number.Equivalence(response.status, 404), {
      onTrue: () => Effect.succeedNone,
      onFalse: () =>
        Effect.gen(function*() {
          yield* requireSuccess(response.status)
          const metadata = yield* response.json.pipe(Effect.flatMap(Schema.decodeUnknown(Metadata)))
          yield* Effect.unless(
            new PublicationError({ message: "npm metadata identifies a different package/version." }),
            () => Boolean.and(String.Equivalence(metadata.name, name), String.Equivalence(metadata.version, version))
          )
          const sha = yield* source(metadata, repository)
          const fs = yield* FileSystem.FileSystem
          const path = yield* Path.Path
          const directory = yield* fs.makeTempDirectoryScoped()
          const archive = path.join(directory, "package.tgz")
          const tarball = yield* request(metadata.dist.tarball)
          yield* requireSuccess(tarball.status)
          yield* Stream.run(tarball.stream, fs.sink(archive))
          // The archive tool owns archive parsing; Effect owns its lifetime and exit status.
          const checksum = yield* Process.output(Command.make("sha512sum", archive)).pipe(
            Effect.map(String.slice(0, 128))
          )
          const expected = yield* Encoding.decodeBase64(String.slice(7)(metadata.dist.integrity)).pipe(
            Effect.map(Encoding.encodeHex)
          )
          yield* Effect.unless(
            new PublicationError({ message: "npm tarball integrity mismatch." }),
            () => String.Equivalence(checksum, expected)
          )
          return Option.some({
            sha,
            integrity: metadata.dist.integrity,
            content: yield* archiveContent(archive)
          })
        })
    })
  }).pipe(Effect.scoped, Effect.timeout("3 minutes"))
