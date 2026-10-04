/**
 * Generate RSA boundary fixtures with OpenSSL, not Theoria or Noble. Both valid
 * and altered inputs are verified by OpenSSL before retention. Private keys live
 * only in a scoped temporary directory. Run with Bun from any directory.
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import {
  Array as Arr,
  Boolean as B,
  Effect,
  FileSystem,
  Number as N,
  Option,
  Path,
  Schema,
  String as Str
} from "effect"
import { Base64Url, Hex } from "effect/encoding"
import { ChildProcess as Command, ChildProcessSpawner } from "effect/process"
import {
  FixtureGenerationFailed,
  requireExit,
  RsaOpenSsl,
  RsaOpenSslCase,
  RsaOpenSslFixture,
  RsaOpenSslGroup
} from "./fixture-contract.js"

const Profile = Schema.Struct({
  bits: Schema.Int,
  exponent: Schema.Int,
  exponentHex: Schema.String
})

const FixtureMessage = Schema.Struct({
  name: Schema.String,
  bytes: Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 255 })))
})

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const generator = Str.trim(yield* spawner.string(Command.make("openssl", ["version"])))
  const profiles = Arr.make(
    Profile.make({ bits: 2048, exponent: 3, exponentHex: "03" }),
    Profile.make({ bits: 2049, exponent: 3, exponentHex: "03" }),
    Profile.make({ bits: 3072, exponent: 65537, exponentHex: "010001" }),
    Profile.make({ bits: 4096, exponent: 4294967295, exponentHex: "ffffffff" })
  )
  const groups = yield* Effect.forEach(profiles, (profile) =>
    Effect.gen(function*() {
      const temporary = yield* fs.makeTempDirectoryScoped()
      const privateKey = path.join(temporary, "private.pem")
      const publicKey = path.join(temporary, "public.pem")
      const messagePath = path.join(temporary, "message.bin")
      const signaturePath = path.join(temporary, "signature.bin")
      const bitsText = yield* Schema.encodeEffect(Schema.FiniteFromString)(profile.bits)
      const exponentText = yield* Schema.encodeEffect(Schema.FiniteFromString)(profile.exponent)
      const name = Arr.join(Arr.make(bitsText, " bits, e=", exponentText), "")
      yield* requireExit(
        Command.make("openssl", [
          "genpkey",
          "-provider",
          "default",
          "-algorithm",
          "RSA",
          "-pkeyopt",
          Str.concat("rsa_keygen_bits:", bitsText),
          "-pkeyopt",
          Str.concat("rsa_keygen_pubexp:", exponentText),
          "-out",
          privateKey
        ]),
        0,
        "generate key"
      )
      yield* requireExit(
        Command.make("openssl", ["pkey", "-in", privateKey, "-pubout", "-out", publicKey]),
        0,
        "export public key"
      )
      // OpenSSL rounds some odd requested sizes down. Verify actual public
      // parameters rather than labelling the result with the requested size.
      yield* spawner.string(
        Command.make("openssl", ["pkey", "-pubin", "-in", publicKey, "-text", "-noout"])
      ).pipe(Effect.filterOrFail(
        (text) =>
          B.and(
            Str.includes(Str.concat(bitsText, " bit)"))(text),
            Str.includes(Str.concat("Exponent: ", Str.concat(exponentText, " (")))(text)
          ),
        () => new FixtureGenerationFailed({ operation: "check actual public parameters" })
      ))
      const modulus = Str.trim(
        yield* spawner.string(Command.make("openssl", ["rsa", "-in", privateKey, "-modulus", "-noout"]))
      )
      const modulusHex = Str.replace("Modulus=", "")(modulus)
      const hexWidth = N.sum(Str.length(modulusHex), N.remainder(Str.length(modulusHex), 2))
      const n = Base64Url.encode(yield* Effect.fromResult(Hex.decode(Str.padStart(hexWidth, "0")(modulusHex))))
      const e = Base64Url.encode(yield* Effect.fromResult(Hex.decode(profile.exponentHex)))
      const messages = Arr.make(
        FixtureMessage.make({ name: "empty", bytes: Arr.empty<number>() }),
        FixtureMessage.make({ name: "binary", bytes: Arr.make(0, 255, 128, 1, 42, 13, 10, 0, 254) }),
        FixtureMessage.make({
          name: "8192 bytes",
          bytes: Arr.makeBy(8192, (index) => N.remainder(N.sum(N.multiply(index, 17), 31), 256))
        })
      )
      const verify = Command.make("openssl", [
        "dgst",
        "-sha256",
        "-verify",
        publicKey,
        "-signature",
        signaturePath,
        messagePath
      ])
      const cases = yield* Effect.forEach(messages, (message) =>
        Effect.gen(function*() {
          const bytes = new Uint8Array(message.bytes)
          yield* fs.writeFile(messagePath, bytes)
          yield* requireExit(
            Command.make("openssl", ["dgst", "-sha256", "-sign", privateKey, "-out", signaturePath, messagePath]),
            0,
            "sign"
          )
          yield* requireExit(verify, 0, "verify genuine signature")
          const signature = yield* fs.readFile(signaturePath)
          const alteredMessage = new Uint8Array(
            yield* Effect.fromOption(
              Arr.match(message.bytes, {
                onEmpty: () => Option.some(Arr.of(1)),
                onNonEmpty: (bytes) =>
                  Arr.modify(
                    bytes,
                    N.decrement(Arr.length(bytes)),
                    (byte) => N.remainder(N.increment(byte), 256)
                  )
              })
            )
          )
          yield* fs.writeFile(messagePath, alteredMessage)
          yield* requireExit(verify, 1, "reject altered message")
          yield* fs.writeFile(messagePath, bytes)
          const changedSignature = yield* Effect.fromOption(
            Arr.modify(
              signature,
              N.decrement(signature.byteLength),
              (byte) => N.remainder(N.increment(byte), 256)
            )
          )
          const alteredSignature = new Uint8Array(changedSignature)
          yield* fs.writeFile(signaturePath, alteredSignature)
          yield* requireExit(verify, 1, "reject altered signature")
          return RsaOpenSslCase.make({
            name: message.name,
            message: Hex.encode(bytes),
            signature: Hex.encode(signature),
            alteredMessage: Hex.encode(alteredMessage),
            alteredSignature: Hex.encode(alteredSignature)
          })
        }))
      return RsaOpenSslGroup.make({
        name,
        bits: profile.bits,
        jwk: { kty: "RSA", n, e },
        cases
      })
    }).pipe(Effect.scoped))
  const fixture = RsaOpenSsl.make({ generator, groups })
  const script = yield* path.fromFileUrl(yield* Schema.decodeEffect(Schema.URLFromString)(import.meta.url))
  const destination = path.resolve(path.dirname(script), "../test/fixtures/conformance/rsa-openssl.json")
  yield* fs.writeFileString(destination, yield* Schema.encodeEffect(RsaOpenSslFixture)(fixture))
}).pipe(Effect.provide(BunServices.layer))

BunRuntime.runMain(program)
