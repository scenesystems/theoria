/** Independent whole-JSON oracle versus incremental identity, cold and warm/fresh. */
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import { blake3 } from "@noble/hashes/blake3.js"
import {
  Array as Arr,
  Config,
  Console,
  Data,
  Duration,
  Effect,
  Match,
  Number as N,
  Option,
  Predicate,
  Record,
  Schema,
  Stream,
  String as Str,
  Tuple
} from "effect"
import { Base64Url } from "effect/encoding"

import type * as CanonicalJson from "../src/CanonicalJson.js"
import * as ContentDigest from "../src/ContentDigest.js"

class Mismatch extends Data.TaggedError("Mismatch") {}
class Input extends Data.Class<{
  readonly value: Schema.Json
  readonly digest: Effect.Effect<ContentDigest.ContentDigest, CanonicalJson.Error | Schema.SchemaError>
}> {}

const input = <A extends Schema.Json>(schema: Schema.Codec<A, unknown>, value: A): Input =>
  new Input({ value, digest: ContentDigest.fromSchema(schema, value) })

const Scalars = Schema.Array(Schema.Union([Schema.Finite, Schema.Boolean, Schema.Null]))
const SmallRecords = Schema.Array(Schema.Struct({
  id: Schema.Finite,
  kind: Schema.String,
  ok: Schema.Boolean,
  tags: Schema.Array(Schema.String)
}))
const Strings = Schema.Array(Schema.String)
const Text = Schema.Struct({ text: Schema.String })
const isEven = (i: number): boolean => N.Equivalence(N.remainder(i, 2), 0)
const scalar = (i: number): (typeof Scalars)["Type"][number] =>
  Match.value(N.remainder(i, 3)).pipe(
    Match.when(0, () => i),
    Match.when(1, () => isEven(i)),
    Match.orElse(() => null)
  )
const makeInput = Match.type<string>().pipe(
  Match.when(
    "numbers",
    () =>
      input(
        Schema.Array(Schema.Finite),
        Arr.makeBy(1_000_000, (i) => N.divideUnsafe(N.remainder(N.multiply(i, 7919), 100_003), 8))
      )
  ),
  Match.when(
    "scalars",
    () => input(Scalars, Arr.makeBy(500_000, scalar))
  ),
  Match.when("records", () =>
    input(
      SmallRecords,
      Arr.makeBy(200_000, (i) => ({
        id: i,
        kind: "x",
        ok: isEven(i),
        tags: ["a", "b"]
      }))
    )),
  Match.when(
    "escaped",
    () =>
      input(
        Strings,
        Arr.makeBy(100_000, (i) => Str.concat(Str.concat("line ", Str.String(i)), "\n\t\"quoted\" \\\\ back \u0001"))
      )
  ),
  Match.when("ascii", () => input(Text, { text: Str.repeat(6_000_000)("a") })),
  Match.when("bmp", () => input(Text, { text: Str.repeat(2_000_000)("漢") })),
  Match.when("astral", () => input(Text, { text: Str.repeat(1_500_000)("\u{10ffff}") })),
  Match.when("escaped-long", () => input(Text, { text: Str.repeat(500_000)("a\n\"\\漢😀") })),
  Match.orElse(() => input(Strings, ["invalid CASE"]))
)

// Independent tree rebuild, then exactly one JSON.stringify through Schema,
// one native UTF-8 encoding through Stream, and direct Noble BLAKE3. No digest
// canonicalization/byte-counting helper participates in this oracle.
const sorted = (value: unknown): unknown => {
  if (Arr.isArray(value)) return Arr.map(value, sorted)
  if (Predicate.isObject(value)) {
    return Record.fromEntries(
      Arr.map(
        Arr.sort(Record.keys(value), Str.Order),
        (key) => Tuple.make(key, sorted(Option.getOrThrow(Record.get(value, key))))
      )
    )
  }
  return value
}
const stringify = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))
const baseline = (value: Schema.Json) =>
  Effect.gen(function*() {
    const text = yield* stringify(sorted(value))
    const bytes = Option.getOrThrow(yield* Stream.make(text).pipe(Stream.encodeText, Stream.runHead))
    return { bytes: bytes.byteLength, digest: Str.concat("blake3-256:", Base64Url.encode(blake3(bytes))) }
  })

const Case = Schema.Literals(["numbers", "scalars", "records", "escaped", "ascii", "bmp", "astral", "escaped-long"])
const Engine = Schema.Literals(["baseline", "candidate"])

BunRuntime.runMain(Effect.gen(function*() {
  const name = yield* Config.String("CASE").pipe(
    Config.withDefault("numbers"),
    Effect.flatMap(Schema.decodeUnknownEffect(Case))
  )
  const engine = yield* Config.String("ENGINE").pipe(
    Config.withDefault("candidate"),
    Effect.flatMap(Schema.decodeUnknownEffect(Engine))
  )
  // No baseline invocation before candidate timing (or vice versa). Each sample
  // constructs its graph outside timing; samples 1..5 warm code, not identity.
  const samples = yield* Effect.forEach(Arr.range(0, 5), (sample) =>
    Effect.gen(function*() {
      const fresh = makeInput(name)
      const operation = engine === "baseline"
        ? Effect.map(baseline(fresh.value), ({ digest }) => digest)
        : Effect.map(fresh.digest, ContentDigest.toString)
      const [elapsed, digest] = yield* Effect.timed(operation)
      return {
        phase: N.Equivalence(sample, 0) ? "cold" : "warm-fresh",
        ms: Duration.toMillis(elapsed),
        digest
      }
    }))
  const reference = yield* baseline(makeInput(name).value)
  if (!Arr.every(samples, (sample) => sample.digest === reference.digest)) return yield* new Mismatch()
  yield* Console.log(
    yield* stringify({
      case: name,
      engine,
      canonicalBytes: reference.bytes,
      targetRatio: 1,
      samples
    })
  )
}))
