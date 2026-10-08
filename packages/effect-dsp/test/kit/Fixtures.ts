import { BunServices } from "@effect/platform-bun"
import * as Digest from "@scenesystems/digest/Digest"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Equal,
  FileSystem,
  Number as Num,
  Option,
  Path,
  Schema
} from "effect"
import * as Hex from "effect/encoding/Hex"

export const Evidence = Schema.Literals(["upstream-execution", "upstream-kernel", "local-regression"])
export type Evidence = typeof Evidence.Type

/** Interpreter environment fixed by the generator before NumPy-backed code is imported. */
export const Environment = Schema.Struct({
  PYTHONHASHSEED: Schema.Literal("0"),
  NPY_DISABLE_CPU_FEATURES: Schema.Literal("AVX2,FMA3,AVX512F")
})
export type Environment = typeof Environment.Type

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Config = Schema.Record(Schema.String, Schema.Int)

/** First acquisition tie that upstream libm/summation order may resolve differently. */
export const InadmissibleTie = Schema.Struct({
  trial: Count,
  dimensions: Schema.NonEmptyArray(Schema.String),
  gap: Schema.Finite,
  tie: Schema.Struct({
    classification: Schema.Literals(["subUlp", "coincidentalCancellation"]),
    winner: Config,
    other: Config
  })
})

/**
 * Study-row accounting for a recorded MIPRO trajectory: sampled trials plus inserted
 * full evaluations plus the baseline row; full-validation runs insert no checkpoints;
 * the strict prefix ends at the last row or immediately before the first inadmissible tie.
 */
export const Trajectory = Schema.Struct({
  sampledTrials: Count,
  minibatch: Schema.Boolean,
  valsetSize: Count,
  sampledEvaluation: Schema.Literals(["minibatch", "fullValidation"]),
  insertedFullEvaluations: Count,
  baselineTrials: Schema.Literal(1),
  totalStudyRows: Count,
  strictThroughTrial: Count,
  firstInadmissibleTie: Schema.OptionFromNullOr(InadmissibleTie)
}).check(
  Schema.makeFilter((t) => t.totalStudyRows === t.sampledTrials + t.insertedFullEvaluations + t.baselineTrials, {
    message: "totalStudyRows must equal sampledTrials + insertedFullEvaluations + baselineTrials"
  }),
  Schema.makeFilter((t) =>
    Equal.equals(
      t.sampledEvaluation,
      Bool.match(t.minibatch, { onTrue: () => "minibatch", onFalse: () => "fullValidation" })
    ), { message: "sampledEvaluation must follow minibatch" }),
  Schema.makeFilter((t) => Bool.or(t.minibatch, t.insertedFullEvaluations === 0), {
    message: "full-validation trajectories insert no checkpoints"
  }),
  Schema.makeFilter((t) =>
    Option.match(t.firstInadmissibleTie, {
      onNone: () => t.strictThroughTrial === Num.decrement(t.totalStudyRows),
      onSome: (tie) => Bool.and(tie.trial === Num.increment(t.strictThroughTrial), tie.trial < t.totalStudyRows)
    }), { message: "strictThroughTrial must end at the last row or immediately before the first inadmissible tie" })
)
export type Trajectory = typeof Trajectory.Type

export const Entry = Schema.Struct({
  id: Schema.String,
  file: Schema.String,
  evidence: Evidence,
  sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  generator: Schema.String,
  description: Schema.String,
  trajectory: Schema.OptionFromOptionalKey(Trajectory),
  /** Recorded only by captures generated with this metadata; legacy entries make no claim. */
  environment: Schema.OptionFromOptionalKey(Environment)
})
export type Entry = typeof Entry.Type

export const Manifest = Schema.Struct({
  upstream: Schema.Struct({
    dspy: Schema.Literal("3.4.0"),
    gepa: Schema.Literal("0.1.4"),
    optuna: Schema.Literal("4.9.0"),
    commits: Schema.Record(Schema.String, Schema.String),
    python: Schema.String,
    platform: Schema.String,
    /** uv.lock resolution asserted by the generator; pyproject only bounds >=1.26,<2. */
    numpy: Schema.Literal("1.26.4")
  }),
  environment: Environment,
  fixtures: Schema.Array(Entry)
}).check(
  Schema.makeFilter(
    (manifest) =>
      Arr.length(Arr.dedupe(Arr.map(manifest.fixtures, (entry) => entry.id))) === Arr.length(manifest.fixtures),
    {
      message: "fixture IDs must be unique"
    }
  )
)
export type Manifest = typeof Manifest.Type

export class FixtureError extends Data.TaggedError("FixtureError")<{
  readonly id: string
  readonly reason: "missing" | "evidence" | "hash" | "identity"
}> {}

const root = Effect.gen(function*() {
  const path = yield* Path.Path
  const url = yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url)
  const filename = yield* path.fromFileUrl(url)
  return path.resolve(path.dirname(filename), "../fixtures/dspy")
})

/** Decodes manifest text, rejecting malformed provenance, environment or trajectory metadata. */
export const decodeManifest = Schema.decodeEffect(Schema.fromJsonString(Manifest))

export const manifest = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  return yield* decodeManifest(yield* fs.readFileString(path.join(yield* root, "manifest.json")))
}).pipe(Effect.provide(BunServices.layer))

/** Decoded manifest entry, including optional trajectory and recorded environment metadata. */
export const entry = Effect.fnUntraced(function*(id: string) {
  const index = yield* manifest
  return yield* Effect.fromOption(
    Arr.findFirst(index.fixtures, (e) => Equal.equals(e.id, id)),
    () => new FixtureError({ id, reason: "missing" })
  )
})

/** Require callers to state their evidence claim before any payload is decoded. */
export const fixture = Effect.fnUntraced(function*(id: string, expectedEvidence: Evidence) {
  const indexed = yield* entry(id)
  yield* Bool.match(Equal.equals(indexed.evidence, expectedEvidence), {
    onFalse: () => Effect.fail(new FixtureError({ id, reason: "evidence" })),
    onTrue: () => Effect.void
  })
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const raw = yield* fs.readFileString(path.join(yield* root, indexed.file))
  const digest = Hex.encode(yield* Digest.hashString("sha256", raw))
  yield* Bool.match(Equal.equals(digest, indexed.sha256), {
    onFalse: () => Effect.fail(new FixtureError({ id, reason: "hash" })),
    onTrue: () => Effect.void
  })
  const doc = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({
    fixture: Schema.String,
    payload: Schema.Unknown
  })))(raw)
  return yield* Bool.match(Equal.equals(doc.fixture, id), {
    onFalse: () => Effect.fail(new FixtureError({ id, reason: "identity" })),
    onTrue: () => Effect.succeed(doc)
  })
}, Effect.provide(BunServices.layer))
