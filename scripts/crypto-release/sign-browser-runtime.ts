import * as Sign from "@scenesystems/sign"
import { Array as Arr, Effect, Either, Encoding, Option, Schema } from "effect"

const Hex = Schema.String.pipe(Schema.pattern(/^(?:[0-9a-fA-F]{2})*$/))
const StrictVerdict = Schema.Literal("valid", "nonmatch", "invalid-input")
const BrowserProfile = Schema.Struct({
  ed25519: Schema.Struct({
    cases: Schema.Array(Schema.Struct({
      id: Schema.NonEmptyString,
      publicKey: Hex,
      message: Hex,
      signature: Hex,
      strictVerdict: StrictVerdict
    }))
  }),
  p256: Schema.Struct({
    cases: Schema.Array(Schema.Struct({
      tcId: Schema.Number,
      publicKey: Schema.Struct({ uncompressed: Hex }),
      message: Hex,
      signature: Hex,
      strictVerdict: StrictVerdict
    }))
  }),
  mlDsa65: Schema.Struct({
    cases: Schema.Array(Schema.Struct({
      tcId: Schema.Number,
      publicKey: Hex,
      message: Hex,
      signature: Hex,
      context: Hex
    })),
    strictVerdicts: Schema.Array(Schema.Struct({ tcId: Schema.Number, verdict: StrictVerdict }))
  })
})

export class SignBrowserQualificationFailure extends Schema.TaggedError<SignBrowserQualificationFailure>()(
  "SignBrowserQualificationFailure",
  { caseId: Schema.NonEmptyString, operation: Schema.NonEmptyString }
) {}

const fail = (caseId: string, operation: string): Effect.Effect<never, SignBrowserQualificationFailure> =>
  new SignBrowserQualificationFailure({ caseId, operation })

const decodeHex = (caseId: string, value: string) =>
  Either.match(Encoding.decodeHex(value), {
    onLeft: () => fail(caseId, "decode-hex"),
    onRight: Effect.succeed
  })

const expected = (
  verdict: Schema.Schema.Type<typeof StrictVerdict>
): boolean | "InvalidVerificationInput" =>
  verdict === "valid" ? true : verdict === "nonmatch" ? false : "InvalidVerificationInput"

const classify = <E extends { readonly _tag: string }>(verification: Effect.Effect<boolean, E>) =>
  verification.pipe(Effect.match({
    onFailure: (error) => error._tag,
    onSuccess: (verified) => verified
  }))

const verifyExpected = (
  caseId: string,
  expectation: boolean | "InvalidVerificationInput",
  actual: boolean | string
) => actual === expectation ? Effect.succeed(actual) : fail(caseId, "classification")

/** Runs the complete retained strict-verification corpus in a browser bundle. */
export const runSignBrowserProfile = (input: unknown) =>
  Effect.gen(function*() {
    const profile = yield* Schema.decodeUnknown(BrowserProfile)(input).pipe(
      Effect.mapError(() => new SignBrowserQualificationFailure({ caseId: "profile", operation: "decode" }))
    )
    const ed25519 = yield* Effect.forEach(profile.ed25519.cases, (entry) =>
      Effect.gen(function*() {
        const actual = yield* classify(Sign.ed25519Verify(
          yield* decodeHex(entry.id, entry.signature),
          yield* decodeHex(entry.id, entry.message),
          yield* decodeHex(entry.id, entry.publicKey)
        ))
        return yield* verifyExpected(entry.id, expected(entry.strictVerdict), actual)
      }))
    const p256 = yield* Effect.forEach(profile.p256.cases, (entry) =>
      Effect.gen(function*() {
        const caseId = `p256:${String(entry.tcId)}`
        const actual = yield* classify(Sign.p256Sha256P1363LowSVerify(
          yield* decodeHex(caseId, entry.signature),
          yield* decodeHex(caseId, entry.message),
          yield* decodeHex(caseId, entry.publicKey.uncompressed)
        ))
        return yield* verifyExpected(caseId, expected(entry.strictVerdict), actual)
      }))
    const mlDsa65 = yield* Effect.forEach(profile.mlDsa65.cases, (entry) =>
      Effect.gen(function*() {
        const caseId = `ml-dsa-65:${String(entry.tcId)}`
        const verdict = yield* Option.match(
          Arr.findFirst(profile.mlDsa65.strictVerdicts, ({ tcId }) => tcId === entry.tcId),
          { onNone: () => fail(caseId, "missing-verdict"), onSome: Effect.succeed }
        )
        const actual = yield* classify(Sign.mlDsa65Verify(
          yield* decodeHex(caseId, entry.signature),
          yield* decodeHex(caseId, entry.message),
          yield* decodeHex(caseId, entry.publicKey),
          yield* decodeHex(caseId, entry.context)
        ))
        return yield* verifyExpected(caseId, expected(verdict.verdict), actual)
      }))
    const classifications = [...ed25519, ...p256, ...mlDsa65]
    return {
      format: "@scenesystems/sign-browser-runtime-v1",
      corpusCases: classifications.length,
      classifications: {
        verified: Arr.filter(classifications, (value) => value === true).length,
        nonmatch: Arr.filter(classifications, (value) => value === false).length,
        invalidInput: Arr.filter(classifications, (value) => value === "InvalidVerificationInput").length
      }
    }
  })
