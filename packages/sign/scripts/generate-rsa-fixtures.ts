/**
 * Generate RSA boundary fixtures with OpenSSL, not Theoria or Noble. Both valid
 * and altered inputs are verified by OpenSSL before retention. Private keys live
 * only in a scoped temporary directory. Run with Bun from any directory.
 */
import { Command, FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Boolean as B, Effect, Encoding, Number as N, Schema, String as Str } from "effect"
import { RsaOpenSslFixture } from "./fixture-contract.js"

class FixtureGenerationFailed extends Schema.TaggedError<FixtureGenerationFailed>()("FixtureGenerationFailed", {
  operation: Schema.String
}) {}

const requireExit = (command: Command.Command, expected: number, operation: string) =>
  Command.exitCode(command).pipe(
    Effect.filterOrFail((code) => N.Equivalence(code, expected), () => new FixtureGenerationFailed({ operation }))
  )

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const generator = Str.trim(yield* Command.string(Command.make("openssl", "version")))
  const profiles = Arr.make(
    { bits: 2048, exponent: 3, exponentHex: "03" },
    { bits: 2049, exponent: 3, exponentHex: "03" },
    { bits: 3072, exponent: 65537, exponentHex: "010001" },
    { bits: 4096, exponent: 4294967295, exponentHex: "ffffffff" }
  )
  const groups = yield* Effect.forEach(profiles, (profile) =>
    Effect.gen(function*() {
      const temporary = yield* fs.makeTempDirectoryScoped()
      const privateKey = path.join(temporary, "private.pem")
      const publicKey = path.join(temporary, "public.pem")
      const messagePath = path.join(temporary, "message.bin")
      const signaturePath = path.join(temporary, "signature.bin")
      const bitsText = yield* Schema.encode(Schema.NumberFromString)(profile.bits)
      const exponentText = yield* Schema.encode(Schema.NumberFromString)(profile.exponent)
      const name = Arr.join(Arr.make(bitsText, " bits, e=", exponentText), "")
      yield* requireExit(
        Command.make(
          "openssl",
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
        ),
        0,
        "generate key"
      )
      yield* requireExit(
        Command.make("openssl", "pkey", "-in", privateKey, "-pubout", "-out", publicKey),
        0,
        "export public key"
      )
      // OpenSSL rounds some odd requested sizes down. Verify actual public
      // parameters rather than labelling the result with the requested size.
      const description = yield* Command.string(
        Command.make("openssl", "pkey", "-pubin", "-in", publicKey, "-text", "-noout")
      )
      yield* Effect.succeed(description).pipe(Effect.filterOrFail(
        (text) =>
          B.and(
            Str.includes(Str.concat(bitsText, " bit)"))(text),
            Str.includes(Str.concat("Exponent: ", Str.concat(exponentText, " (")))(text)
          ),
        () => new FixtureGenerationFailed({ operation: "check actual public parameters" })
      ))
      const modulus = Str.trim(
        yield* Command.string(Command.make("openssl", "rsa", "-in", privateKey, "-modulus", "-noout"))
      )
      const modulusHex = Str.replace("Modulus=", "")(modulus)
      const hexWidth = N.sum(Str.length(modulusHex), N.remainder(Str.length(modulusHex), 2))
      const n = Encoding.encodeBase64Url(yield* Encoding.decodeHex(Str.padStart(hexWidth, "0")(modulusHex)))
      const e = Encoding.encodeBase64Url(yield* Encoding.decodeHex(profile.exponentHex))
      const messages = Arr.make(
        { name: "empty", bytes: Arr.empty<number>() },
        { name: "binary", bytes: Arr.make(0, 255, 128, 1, 42, 13, 10, 0, 254) },
        { name: "8192 bytes", bytes: Arr.makeBy(8192, (index) => N.remainder(N.sum(N.multiply(index, 17), 31), 256)) }
      )
      const verify = Command.make(
        "openssl",
        "dgst",
        "-sha256",
        "-verify",
        publicKey,
        "-signature",
        signaturePath,
        messagePath
      )
      const cases = yield* Effect.forEach(messages, (message) =>
        Effect.gen(function*() {
          const bytes = yield* Schema.decode(Schema.Uint8Array)(message.bytes)
          yield* fs.writeFile(messagePath, bytes)
          yield* requireExit(
            Command.make("openssl", "dgst", "-sha256", "-sign", privateKey, "-out", signaturePath, messagePath),
            0,
            "sign"
          )
          yield* requireExit(verify, 0, "verify genuine signature")
          const signature = yield* fs.readFile(signaturePath)
          const alteredMessage = yield* Schema.decode(Schema.Uint8Array)(B.match(Arr.isEmptyArray(message.bytes), {
            onTrue: () => Arr.of(1),
            onFalse: () =>
              Arr.modify(
                message.bytes,
                N.decrement(Arr.length(message.bytes)),
                (byte) => N.remainder(N.increment(byte), 256)
              )
          }))
          yield* fs.writeFile(messagePath, alteredMessage)
          yield* requireExit(verify, 1, "reject altered message")
          yield* fs.writeFile(messagePath, bytes)
          const changedSignature = yield* Arr.modifyOption(
            signature,
            N.decrement(signature.length),
            (byte) => N.remainder(N.increment(byte), 256)
          )
          const alteredSignature = yield* Schema.decode(Schema.Uint8Array)(changedSignature)
          yield* fs.writeFile(signaturePath, alteredSignature)
          yield* requireExit(verify, 1, "reject altered signature")
          return {
            name: message.name,
            message: Encoding.encodeHex(bytes),
            signature: Encoding.encodeHex(signature),
            alteredMessage: Encoding.encodeHex(alteredMessage),
            alteredSignature: Encoding.encodeHex(alteredSignature)
          }
        }))
      return { name, bits: profile.bits, jwk: { kty: "RSA", n, e }, cases }
    }).pipe(Effect.scoped))
  const fixture = yield* Schema.decodeUnknown(Schema.typeSchema(RsaOpenSslFixture))({ generator, groups })
  const destination = yield* path.fromFileUrl(
    yield* Url.fromString("../test/fixtures/conformance/rsa-openssl.json", import.meta.url)
  )
  yield* fs.writeFileString(destination, yield* Schema.encode(RsaOpenSslFixture)(fixture))
}).pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(program)
