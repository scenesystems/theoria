/** Linux/Bun release entry point. GitHub YAML declares triggers and permissions, not release policy. */
import { Command, Options } from "@effect/cli"
import { FetchHttpClient } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array, Config, Effect, Layer, Match, Option, Schema, String } from "effect"
import * as Candidate from "./release/Candidate.js"
import * as GitHub from "./release/GitHub.js"
import * as Invocation from "./release/Invocation.js"
import * as Repository from "./release/Repository.js"
import * as Website from "./release/Website.js"

const text = (name: string, environment: string) =>
  Options.text(name).pipe(Options.withFallbackConfig(Config.string(environment)))
const sha = text("sha", "BUILD_SHA").pipe(Options.withSchema(Repository.Sha))
const runId = Options.text("run-id").pipe(
  Options.withFallbackConfig(Config.string("RUN_ID").pipe(Config.orElse(() => Config.string("GITHUB_RUN_ID")))),
  Options.withSchema(Candidate.Id)
)
const reviewed = Options.text("reviewed-run-id").pipe(
  Options.withFallbackConfig(Config.string("REVIEWED_RUN_ID").pipe(Config.withDefault(""))),
  Options.withSchema(Schema.Union(Candidate.Id, Schema.Literal(""))),
  Options.map(Option.liftPredicate(Schema.is(Candidate.Id)))
)
const output = text("output", "RELEASE_OUTPUT")
const file = text("candidate", "CANDIDATE")

const capture = Command.make("record", {
  sha,
  runId,
  output,
  attempt: text("attempt", "GITHUB_RUN_ATTEMPT").pipe(Options.withSchema(Candidate.Id)),
  site: text("site-artifact", "SITE_ARTIFACT_ID").pipe(Options.withSchema(Candidate.Id)),
  packages: text("package-artifact", "PACKAGE_ARTIFACT_ID").pipe(Options.withSchema(Candidate.Id))
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
  publishing: Options.boolean("publication-event").pipe(
    Options.withFallbackConfig(Config.boolean("PUBLICATION_EVENT").pipe(Config.withDefault(false)))
  )
}, ({ runId, reviewed, output, publishing }) => GitHub.select(runId, reviewed, output, publishing))

const pin = Command.make(
  "pin",
  { sha, runId, reviewed },
  ({ sha, runId, reviewed }) => GitHub.pin(sha, runId, reviewed)
)

const check = Command.make("check", { file, output }, ({ file, output }) =>
  Effect.gen(function*() {
    const candidate = yield* Candidate.read(file)
    yield* Candidate.verifyPrepared(candidate)
    yield* Candidate.verifyPublication(candidate, yield* GitHub.repository, false, output)
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
    yield* Candidate.verifyPublication(candidate, yield* GitHub.repository, true, output)
    yield* GitHub.summary(
      String.concat(
        "All candidate packages match npm provenance and content. Website promotion is a separate choice. Use Theoria Production with run_id: ",
        candidate.run_id
      )
    )
  }))

const ready = Command.make("ready", {
  mode: text("mode", "CHANGESETS_MODE").pipe(Options.withSchema(Schema.Literal("version", "publish", "none")))
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
  { sha, target: Options.text("target").pipe(Options.withSchema(Website.Target)) },
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
  noindex: Options.boolean("noindex").pipe(Options.withFallbackConfig(Config.boolean("NOINDEX"))),
  attempts: Options.integer("attempts").pipe(
    Options.withFallbackConfig(Config.integer("ATTEMPTS").pipe(Config.withDefault(60)))
  ),
  delay: Options.integer("delay-seconds").pipe(
    Options.withFallbackConfig(Config.integer("DELAY_SECONDS").pipe(Config.withDefault(10)))
  )
}, ({ sha, origin, noindex, attempts, delay }) => Website.verify(origin, sha, noindex, attempts, delay))

const review = Command.make("review", {
  before: Options.text("before").pipe(Options.withSchema(Repository.Sha)),
  after: Options.text("after").pipe(Options.withSchema(Repository.Sha))
}, ({ before, after }) => Repository.review(before, after))

const run = Command.make("release").pipe(
  Command.withSubcommands(Array.make(capture, resolve, pin, check, packed, published, ready, deploy, verify, review)),
  Command.run({ name: "Theoria release", version: "2.0.0" })
)

BunRuntime.runMain(
  Invocation.read(import.meta.url).pipe(
    Effect.flatMap(run),
    Effect.provide(Layer.merge(BunContext.layer, FetchHttpClient.layer))
  )
)
