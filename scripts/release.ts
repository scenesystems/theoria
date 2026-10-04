/** Linux/Bun release entry point. GitHub YAML declares triggers and permissions, not release policy. */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Array, Config, Effect, Layer, Match, Option, Schema, String } from "effect"
import { Command, Flag } from "effect/cli"
import { FetchHttpClient } from "effect/http"
import * as Bootstrap from "./release/Bootstrap.js"
import * as Candidate from "./release/Candidate.js"
import * as GitHub from "./release/GitHub.js"
import * as Repository from "./release/Repository.js"
import * as Website from "./release/Website.js"

const text = (name: string, environment: string) =>
  Flag.String(name).pipe(Flag.withFallbackConfig(Config.String(environment)))
const sha = text("sha", "BUILD_SHA").pipe(Flag.withSchema(Repository.Sha))
const runId = Flag.String("run-id").pipe(
  Flag.withFallbackConfig(Config.String("RUN_ID").pipe(Config.orElse(() => Config.String("GITHUB_RUN_ID")))),
  Flag.withSchema(Candidate.Id)
)
const reviewed = Flag.String("reviewed-run-id").pipe(
  Flag.withFallbackConfig(Config.String("REVIEWED_RUN_ID").pipe(Config.withDefault(""))),
  Flag.withSchema(Schema.Union([Candidate.Id, Schema.Literal("")])),
  Flag.map(Option.liftPredicate(Schema.is(Candidate.Id)))
)
const output = text("output", "RELEASE_OUTPUT")
const file = text("candidate", "CANDIDATE")
const names = text("packages", "BOOTSTRAP_PACKAGES").pipe(Flag.withSchema(Schema.fromJsonString(Bootstrap.Names)))
const directory = text("directory", "PACKED_DIRECTORY")

const capture = Command.make("record", {
  sha,
  runId,
  output,
  attempt: text("attempt", "GITHUB_RUN_ATTEMPT").pipe(Flag.withSchema(Candidate.Id)),
  site: text("site-artifact", "SITE_ARTIFACT_ID").pipe(Flag.withSchema(Candidate.Id)),
  packages: text("package-artifact", "PACKAGE_ARTIFACT_ID").pipe(Flag.withSchema(Candidate.Id))
}, ({ sha, runId, output, attempt, site, packages }) =>
  Effect.gen(function*() {
    const candidate = yield* Candidate.capture({
      schema: 2,
      sha,
      run_id: runId,
      run_attempt: attempt,
      artifact_id: site,
      package_artifact_id: packages
    })
    yield* Candidate.write(output, Candidate.Record, candidate)
    yield* GitHub.summary(Array.join(
      Array.make(
        "## Staging verified; production is unchanged",
        "Review https://theoria.staging.scenesystems.io before approving this candidate.",
        String.concat("Candidate run_id: ", runId),
        "1. Merge the Version Packages PR if packages need new versions, then review the resulting staging candidate.",
        "2. Run Publish Packages on main with the chosen run_id. Wait for its pinned tag run to finish.",
        "3. Separately run Theoria Production on main with that same run_id when ready.",
        "Production requires matching npm package content and promotes this website artifact without rebuilding.",
        "Optional reviewed_run_id carries review forward only across verified version-only changes. Artifacts expire after seven days."
      ),
      "\n\n"
    ))
  }))

const resolve = Command.make("resolve", {
  runId,
  reviewed,
  output,
  publishing: Flag.Boolean("publication-event").pipe(
    Flag.withFallbackConfig(Config.Boolean("PUBLICATION_EVENT").pipe(Config.withDefault(false)))
  )
}, ({ runId, reviewed, output, publishing }) => GitHub.select(runId, reviewed, output, publishing))

const pin = Command.make(
  "pin",
  { sha, runId, reviewed },
  ({ sha, runId, reviewed }) => GitHub.pin(sha, runId, reviewed)
)

const bootstrapPin = Command.make(
  "bootstrap-pin",
  { sha, runId, reviewed, names },
  ({ sha, runId, reviewed, names }) => GitHub.pin(sha, runId, reviewed, Option.some(names))
)

const bootstrapCheck = Command.make(
  "bootstrap-check",
  { file, names, authenticated: Flag.Boolean("authenticated").pipe(Flag.withDefault(false)) },
  ({ file, names, authenticated }) =>
    Effect.gen(function*() {
      const candidate = yield* Candidate.read(file)
      const token = authenticated
        ? Option.some(yield* Config.schema(Schema.RedactedFromValue(Schema.NonEmptyString), "NODE_AUTH_TOKEN"))
        : Option.none()
      return yield* Bootstrap.requireNew(candidate, names, token)
    })
)

const bootstrapPack = Command.make(
  "bootstrap-pack",
  { file, names, directory, output },
  ({ file, names, directory, output }) =>
    Candidate.read(file).pipe(Effect.flatMap((candidate) => Bootstrap.pack(candidate, names, directory, output)))
)

const bootstrapPacked = Command.make(
  "bootstrap-packed",
  { file, names, directory },
  ({ file, names, directory }) =>
    Candidate.read(file).pipe(Effect.flatMap((candidate) => Bootstrap.verifyPacked(candidate, names, directory)))
)

const bootstrapPublished = Command.make(
  "bootstrap-published",
  { file, names, output },
  ({ file, names, output }) =>
    Effect.gen(function*() {
      const candidate = yield* Candidate.read(file)
      const repository = yield* GitHub.repository
      yield* Bootstrap.verifyPublication(candidate, names, repository, output)
      yield* GitHub.summary(String.concat(
        "Bootstrap publications match the candidate content and provenance. Configure each package's Trusted Publisher (publish.yml, environment npm), revoke the bootstrap token, then use Publish Packages for the remaining candidate packages. Bootstrapped: ",
        Array.join(names, ", ")
      ))
    })
)

const check = Command.make("check", { file, output }, ({ file, output }) =>
  Effect.gen(function*() {
    const candidate = yield* Candidate.read(file)
    yield* Candidate.verifyPrepared(candidate)
    const repository = yield* GitHub.repository
    yield* Candidate.verifyPublication(candidate, repository, false, output)
  }))

const packed = Command.make(
  "packed",
  { file, directory: text("directory", "PACKED_DIRECTORY") },
  ({ file, directory }) =>
    Candidate.read(file).pipe(Effect.flatMap((candidate) => Candidate.verifyPacked(candidate, directory)))
)

const published = Command.make("published", { file, output }, ({ file, output }) =>
  Effect.gen(function*() {
    const candidate = yield* Candidate.read(file)
    const repository = yield* GitHub.repository
    yield* Candidate.verifyPublication(candidate, repository, true, output)
    yield* GitHub.summary(
      String.concat(
        "All candidate packages match npm provenance and content. Website promotion is a separate choice. Use Theoria Production with run_id: ",
        candidate.run_id
      )
    )
  }))

const ReleaseMode = Schema.Literals(["version", "publish", "none"])
const ready = Command.make("ready", {
  mode: Flag.Literals("mode", ReleaseMode.literals).pipe(
    Flag.withFallbackConfig(Config.schema(ReleaseMode, "CHANGESETS_MODE"))
  )
}, ({ mode }) =>
  Match.value(mode).pipe(
    Match.when("version", () =>
      Effect.fail(
        new Candidate.CandidateError({
          message:
            "Pending changesets remain. Merge the Version Packages PR and select its staging candidate before publishing."
        })
      )),
    Match.when("publish", () => Effect.log("Candidate is ready to pack unpublished versions.")),
    Match.when("none", () => Effect.log("Every candidate package version is already published.")),
    Match.exhaustive
  ))

const deploy = Command.make(
  "deploy",
  { sha, target: Flag.Literals("target", Website.Target.literals) },
  ({ sha, target }) =>
    Effect.gen(function*() {
      const origin = Match.value(target).pipe(
        Match.when("staging", () => "https://theoria.staging.scenesystems.io"),
        Match.when("production", () => "https://theoria.scenesystems.io"),
        Match.exhaustive
      )
      yield* Website.deploy(sha, target)
      yield* Website.verify(origin, sha, String.Equivalence(target, "staging"))
      yield* GitHub.summary(Array.join(Array.make("Verified ", target, " serves commit ", sha, " at ", origin), ""))
    })
)

const verify = Command.make("verify", {
  sha,
  origin: text("url", "BASE_URL"),
  noindex: Flag.Boolean("noindex").pipe(Flag.withFallbackConfig(Config.Boolean("NOINDEX"))),
  attempts: Flag.Int("attempts").pipe(
    Flag.withFallbackConfig(Config.Int("ATTEMPTS").pipe(Config.withDefault(60)))
  ),
  delay: Flag.Int("delay-seconds").pipe(
    Flag.withFallbackConfig(Config.Int("DELAY_SECONDS").pipe(Config.withDefault(10)))
  )
}, ({ sha, origin, noindex, attempts, delay }) => Website.verify(origin, sha, noindex, attempts, delay))

const review = Command.make("review", {
  before: Flag.String("before").pipe(Flag.withSchema(Repository.Sha)),
  after: Flag.String("after").pipe(Flag.withSchema(Repository.Sha))
}, ({ before, after }) => Repository.review(before, after))

const run = Command.make("release").pipe(
  Command.withSubcommands(
    Array.make(
      capture,
      resolve,
      pin,
      check,
      packed,
      published,
      ready,
      deploy,
      verify,
      review,
      bootstrapPin,
      bootstrapCheck,
      bootstrapPack,
      bootstrapPacked,
      bootstrapPublished
    )
  )
)

BunRuntime.runMain(
  Command.run(run, { version: "2.0.0" }).pipe(
    Effect.provide(Layer.merge(BunServices.layer, FetchHttpClient.layer))
  )
)
