import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"
import type { Record } from "effect"
import * as Fixtures from "../kit/Fixtures.js"

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))
const encoded = Effect.flatMap(Fixtures.manifest, Schema.encodeEffect(Fixtures.Manifest))

/** Feeds edited metadata through the same text decoder the kit uses and returns its rejection. */
const rejection = (manifest: unknown) =>
  encodeJson(manifest).pipe(Effect.flatMap((raw) => Effect.flip(Fixtures.decodeManifest(raw))))

const withEntry = (
  manifest: typeof Fixtures.Manifest.Encoded,
  id: string,
  patch: Record.ReadonlyRecord<string, unknown>
) => ({
  ...manifest,
  fixtures: Arr.map(
    manifest.fixtures,
    (entry): Record.ReadonlyRecord<string, unknown> =>
      Option.match(Option.liftPredicate(entry, (candidate) => candidate.id === id), {
        onNone: () => entry,
        onSome: (selected) => ({ ...selected, ...patch })
      })
  )
})

const trajectoryOf = (manifest: typeof Fixtures.Manifest.Encoded, id: string) =>
  Effect.fromOption(Arr.findFirst(manifest.fixtures, (entry) => entry.id === id)).pipe(
    Effect.flatMap((entry) => Effect.fromOption(Option.fromUndefinedOr(entry.trajectory)))
  )

const newCaptures = [
  "bootstrap-teacher-trace-calls",
  "bootstrapfewshot-teacher-settings",
  "miprov2-default-grounded"
]

it.effect("decodes the locked NumPy resolution, generator environment, capture environments and trajectories", () =>
  Effect.gen(function*() {
    const manifest = yield* Fixtures.manifest
    expect(manifest.upstream.numpy).toBe("1.26.4")
    expect(manifest.environment).toEqual({ PYTHONHASHSEED: "0", NPY_DISABLE_CPU_FEATURES: "AVX2,FMA3,AVX512F" })
    yield* Effect.forEach(
      newCaptures,
      (id) =>
        Effect.map(
          Fixtures.entry(id),
          (entry) => expect(entry.environment, id).toEqual(Option.some(manifest.environment))
        )
    )
    // Legacy captures predate per-entry environment metadata; the kit must not invent one.
    expect((yield* Fixtures.entry("eval-failure-inclusive")).environment).toEqual(Option.none())
    const explicit = yield* Effect.fromOption((yield* Fixtures.entry("miprov2-explicit")).trajectory)
    expect(explicit.strictThroughTrial).toBe(10)
    expect(Option.map(explicit.firstInadmissibleTie, (tie) => tie.trial)).toEqual(Option.some(11))
    const grounded = yield* Effect.fromOption((yield* Fixtures.entry("miprov2-default-grounded")).trajectory)
    expect(grounded.firstInadmissibleTie).toEqual(Option.none())
    expect(grounded.strictThroughTrial).toBe(grounded.totalStudyRows - 1)
  }))

it.effect("rejects a NumPy resolution other than the uv.lock pin", () =>
  Effect.gen(function*() {
    const manifest = yield* encoded
    expect((yield* rejection({ ...manifest, upstream: { ...manifest.upstream, numpy: "2.0.0" } })).message)
      .toContain("numpy")
    const { numpy: _, ...unpinned } = manifest.upstream
    expect((yield* rejection({ ...manifest, upstream: unpinned })).message).toContain("numpy")
  }))

it.effect("rejects missing or altered generator environment metadata", () =>
  Effect.gen(function*() {
    const manifest = yield* encoded
    const { environment: _, ...missing } = manifest
    expect((yield* rejection(missing)).message).toContain("environment")
    expect((yield* rejection({ ...manifest, environment: { ...manifest.environment, PYTHONHASHSEED: "1" } })).message)
      .toContain("PYTHONHASHSEED")
    expect(
      (yield* rejection({ ...manifest, environment: { PYTHONHASHSEED: "0" } })).message
    ).toContain("NPY_DISABLE_CPU_FEATURES")
  }))

it.effect("rejects altered or partial capture environments and duplicated fixture IDs", () =>
  Effect.gen(function*() {
    const manifest = yield* encoded
    expect(
      (yield* rejection(withEntry(manifest, "miprov2-default-grounded", {
        environment: { PYTHONHASHSEED: "0", NPY_DISABLE_CPU_FEATURES: "AVX512F" }
      }))).message
    ).toContain("NPY_DISABLE_CPU_FEATURES")
    expect(
      (yield* rejection(withEntry(manifest, "bootstrapfewshot-teacher-settings", {
        environment: { PYTHONHASHSEED: "0" }
      }))).message
    ).toContain("NPY_DISABLE_CPU_FEATURES")
    // A duplicated ID would make fixture lookup ambiguous.
    expect(
      (yield* rejection({ ...manifest, fixtures: Arr.appendAll(manifest.fixtures, Arr.take(manifest.fixtures, 1)) }))
        .message
    ).toContain("fixture IDs must be unique")
    // The edited manifest round-trips unchanged, so each rejection is caused by its edit alone.
    const raw = yield* encodeJson(manifest)
    expect((yield* Fixtures.decodeManifest(raw)).fixtures).toHaveLength(manifest.fixtures.length)
  }))

it.effect("rejects trajectory accounting that cannot describe the recorded study rows", () =>
  Effect.gen(function*() {
    const manifest = yield* encoded
    const explicit = yield* trajectoryOf(manifest, "miprov2-explicit")
    const light = yield* trajectoryOf(manifest, "mipro-trial-budget")
    const cases = [
      {
        id: "miprov2-explicit",
        trajectory: { ...explicit, totalStudyRows: explicit.totalStudyRows + 1 },
        message: "totalStudyRows must equal"
      },
      {
        id: "miprov2-explicit",
        trajectory: { ...explicit, sampledEvaluation: "fullValidation" },
        message: "sampledEvaluation must follow minibatch"
      },
      {
        id: "miprov2-explicit",
        trajectory: { ...explicit, strictThroughTrial: explicit.strictThroughTrial + 1 },
        message: "strictThroughTrial must end"
      },
      {
        id: "miprov2-explicit",
        trajectory: { ...explicit, firstInadmissibleTie: null },
        message: "strictThroughTrial must end"
      },
      {
        id: "mipro-trial-budget",
        trajectory: { ...light, insertedFullEvaluations: 1, totalStudyRows: light.totalStudyRows + 1 },
        message: "full-validation trajectories insert no checkpoints"
      },
      {
        id: "mipro-trial-budget",
        trajectory: { ...light, strictThroughTrial: light.totalStudyRows },
        message: "strictThroughTrial must end"
      },
      {
        id: "mipro-trial-budget",
        trajectory: { ...light, baselineTrials: 0, totalStudyRows: light.totalStudyRows - 1 },
        message: "baselineTrials"
      }
    ]
    yield* Effect.forEach(cases, ({ id, message, trajectory }) =>
      Effect.map(
        rejection(withEntry(manifest, id, { trajectory })),
        (failure) => expect(failure.message, `${id}: ${message}`).toContain(message)
      ))
  }))
