/** GitHub's CLI owns API pagination and artifact transport; Effect owns policy and lifetime. */
import { Command, FileSystem, Path } from "@effect/platform"
import { Array, Boolean, Config, Effect, Option, Schema, String } from "effect"
import * as Candidate from "./Candidate.js"
import * as Process from "./Process.js"
import * as Repository from "./Repository.js"

export const repository = Config.string("GITHUB_REPOSITORY").pipe(Config.withDefault("scenesystems/theoria"))
const numberText = Schema.encodeSync(Schema.NumberFromString)
const join = (...parts: Array.NonEmptyReadonlyArray<string>) => Array.join(parts, "")
const tag = (sha: Repository.Sha) => String.concat("theoria-candidate-", sha)

const Run = Schema.Struct({
  path: Schema.Literal(".github/workflows/theoria.yml"),
  head_branch: Schema.Literal("main"),
  head_sha: Repository.Sha,
  head_repository: Schema.Struct({ full_name: Schema.String }),
  event: Schema.Literal("push", "workflow_dispatch"),
  status: Schema.Literal("completed"),
  conclusion: Schema.Literal("success"),
  run_attempt: Schema.Number.pipe(Schema.int(), Schema.positive())
})
const Jobs = Schema.Struct({
  jobs: Schema.Array(Schema.Struct({
    name: Schema.String,
    conclusion: Schema.OptionFromNullOr(Schema.String)
  }))
})
const Artifact = Schema.Struct({ id: Schema.Number, name: Schema.String, expired: Schema.Boolean })
const Artifacts = Schema.Struct({ artifacts: Schema.Array(Artifact) })
const Ref = Schema.Struct({ ref: Schema.String, object: Schema.Struct({ type: Schema.String, sha: Repository.Sha }) })

const Arguments = Schema.Array(Schema.String)
const api = (endpoint: string, ...args: typeof Arguments.Type) =>
  Effect.gen(function*() {
    const repo = yield* repository
    return yield* Process.output(Command.make("gh", "api", join("repos/", repo, "/", endpoint), ...args))
  })

export const summary = (text: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const file = yield* Config.option(Config.string("GITHUB_STEP_SUMMARY"))
    yield* Option.match(file, {
      onNone: () => Effect.log(text),
      onSome: (file) => fs.writeFileString(file, String.concat(text, "\n\n"), { flag: "a" })
    })
  })

/** Every attempt, artifact identity and package declaration is checked before credentials are requested. */
export const resolve = (runId: Candidate.Id) =>
  Effect.gen(function*() {
    const repo = yield* repository
    const endpoint = String.concat("actions/runs/", runId)
    const run = yield* api(endpoint).pipe(Effect.flatMap(Schema.decode(Schema.parseJson(Run))))
    yield* Effect.unless(
      new Candidate.CandidateError({ message: "Staging run belongs to a different repository." }),
      () => String.Equivalence(run.head_repository.full_name, repo)
    )
    const attempt = numberText(run.run_attempt)
    const jobs = yield* api(join(endpoint, "/attempts/", attempt, "/jobs?per_page=100"), "--paginate", "--slurp").pipe(
      Effect.flatMap(Schema.decode(Schema.parseJson(Schema.Array(Jobs)))),
      Effect.map(Array.flatMap((page) => page.jobs))
    )
    yield* Effect.unless(
      new Candidate.CandidateError({ message: "Selected attempt has no successful Staging job." }),
      () =>
        Array.some(
          jobs,
          (job) => Boolean.and(String.Equivalence(job.name, "Staging"), Option.contains("success")(job.conclusion))
        )
    )
    yield* Repository.git("fetch", "--quiet", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main")
    yield* Repository.git("merge-base", "--is-ancestor", run.head_sha, "origin/main")
    const artifacts = yield* api(String.concat(endpoint, "/artifacts?per_page=100"), "--paginate", "--slurp").pipe(
      Effect.flatMap(Schema.decode(Schema.parseJson(Schema.Array(Artifacts)))),
      Effect.map(Array.flatMap((page) => page.artifacts))
    )
    const requireArtifact = (name: string, id: Option.Option<Candidate.Id>) =>
      Effect.gen(function*() {
        const matching = Array.filter(artifacts, (artifact) => String.Equivalence(artifact.name, name))
        const [artifact] = yield* Schema.decodeUnknown(Schema.Tuple(Artifact))(matching)
        yield* Effect.unless(
          new Candidate.CandidateError({
            message: String.concat("Staged artifact is expired or has a different identity: ", name)
          }),
          () =>
            Boolean.and(
              Boolean.not(artifact.expired),
              Option.match(id, { onNone: () => true, onSome: (id) => String.Equivalence(id, numberText(artifact.id)) })
            )
        )
      })
    yield* requireArtifact("theoria-candidate", Option.none())
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped()
    yield* Process.output(
      Command.make("gh", "run", "download", runId, "--repo", repo, "--name", "theoria-candidate", "--dir", directory)
    )
    const candidate = yield* Candidate.read(path.join(directory, "release-candidate.json"))
    yield* Effect.unless(
      new Candidate.CandidateError({ message: "Candidate record does not identify the selected staging attempt." }),
      () =>
        Boolean.every(Array.make(
          String.Equivalence(candidate.sha, run.head_sha),
          String.Equivalence(candidate.run_id, runId),
          String.Equivalence(candidate.run_attempt, attempt)
        ))
    )
    yield* requireArtifact(String.concat("theoria-", candidate.sha), Option.some(candidate.artifact_id))
    yield* requireArtifact(
      String.concat("theoria-packages-", candidate.sha),
      Option.some(candidate.package_artifact_id)
    )
    yield* Candidate.validatePackages(candidate)
    return candidate
  }).pipe(Effect.scoped, Effect.timeout("4 minutes"))

/** Dispatching on main approves the chosen candidate; dispatching on a tag must bind the event SHA too. */
export const bindPublicationEvent = (sha: Repository.Sha) =>
  Effect.gen(function*() {
    const ref = yield* Config.string("GITHUB_REF")
    yield* Effect.unless(
      Effect.gen(function*() {
        const eventSha = yield* Config.string("GITHUB_SHA")
        yield* Effect.unless(
          new Candidate.CandidateError({ message: "Publishing event does not identify the staged candidate." }),
          () =>
            Boolean.and(
              String.Equivalence(ref, String.concat("refs/tags/", tag(sha))),
              String.Equivalence(eventSha, sha)
            )
        )
      }),
      () => String.Equivalence(ref, "refs/heads/main")
    )
  })

export const select = (
  runId: Candidate.Id,
  reviewed: Option.Option<Candidate.Id>,
  output: string,
  publishing: boolean
) =>
  Effect.gen(function*() {
    const candidate = yield* resolve(runId)
    yield* Option.match(reviewed, {
      onNone: () => Effect.void,
      onSome: (id) => resolve(id).pipe(Effect.flatMap((before) => Repository.review(before.sha, candidate.sha)))
    })
    yield* Effect.when(bindPublicationEvent(candidate.sha), () => publishing)
    yield* Candidate.write(output, Candidate.Record, candidate)
    const fs = yield* FileSystem.FileSystem
    const outputs = yield* Config.string("GITHUB_OUTPUT")
    yield* fs.writeFileString(
      outputs,
      Array.join(
        Array.make(
          String.concat("build-sha=", candidate.sha),
          String.concat("artifact-id=", candidate.artifact_id),
          String.concat("package-artifact-id=", candidate.package_artifact_id),
          String.concat("path=", output),
          ""
        ),
        "\n"
      ),
      { flag: "a" }
    )
    const repo = yield* repository
    yield* summary(join(
      "## Selected release candidate\n\n[Staging run ",
      runId,
      "](https://github.com/",
      repo,
      "/actions/runs/",
      runId,
      ") · [commit ",
      candidate.sha,
      "](https://github.com/",
      repo,
      "/commit/",
      candidate.sha,
      ")\n\n",
      Option.match(reviewed, {
        onNone: () => "This dispatch approves the selected candidate directly.",
        onSome: (id) => String.concat("Verified version-only successor of reviewed run ", id)
      }),
      "\n\n| Package | Version |\n| --- | --- |\n",
      Array.join(Array.map(candidate.packages, (pkg) => join("| ", pkg.name, " | ", pkg.version, " |")), "\n")
    ))
  })

/** External mutation: called only by the explicitly dispatched main publication job. */
export const pin = (sha: Repository.Sha, runId: Candidate.Id, reviewed: Option.Option<Candidate.Id>) =>
  Effect.gen(function*() {
    const name = tag(sha)
    const ref = String.concat("refs/tags/", name)
    const refs = yield* api(String.concat("git/matching-refs/tags/", name)).pipe(
      Effect.flatMap(Schema.decode(Schema.parseJson(Schema.Array(Ref))))
    )
    const existing = Array.filter(refs, (entry) => String.Equivalence(entry.ref, ref))
    yield* Effect.if(Array.isEmptyArray(existing), {
      onTrue: () =>
        api("git/refs", "--method", "POST", "-f", String.concat("ref=", ref), "-f", String.concat("sha=", sha)),
      onFalse: () =>
        Effect.gen(function*() {
          const [entry] = yield* Schema.decodeUnknown(Schema.Tuple(Ref))(existing)
          yield* Effect.unless(
            new Candidate.CandidateError({ message: "Candidate tag already points elsewhere; refusing to move it." }),
            () =>
              Boolean.and(String.Equivalence(entry.object.type, "commit"), String.Equivalence(entry.object.sha, sha))
          )
          return ""
        })
    })
    const repo = yield* repository
    yield* Process.output(
      Command.make(
        "gh",
        "workflow",
        "run",
        "publish.yml",
        "--repo",
        repo,
        "--ref",
        name,
        "-f",
        String.concat("run_id=", runId),
        "-f",
        String.concat("reviewed_run_id=", Option.getOrElse(reviewed, () => ""))
      )
    )
    yield* summary(
      join(
        "## Pinned publication started; packages are not published yet\n\nWait for the [tag run](https://github.com/",
        repo,
        "/actions/workflows/publish.yml?query=branch%3A",
        name,
        ") to succeed. Production remains unchanged. Promote run_id ",
        runId,
        " separately."
      )
    )
  })
