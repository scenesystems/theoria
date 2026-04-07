import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Order, Schema } from "effect"

import { parseTypeScript, resolveRootFrom, stringLiterals, variableInitializerTexts } from "@theoria/source-proof"

import {
  AgreementAlgorithm,
  AgreementSupportMatrix,
  AlgorithmSupportMatrix,
  KemAlgorithm,
  KemSupportMatrix,
  SignatureAlgorithm,
  SignatureSupportMatrix
} from "../../src/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const initializerStringLiterals = (
  fileName: string,
  source: string,
  variableName: string
): ReadonlyArray<string> => {
  const initializerTexts = variableInitializerTexts(parseTypeScript(fileName, source), variableName)
  expect(initializerTexts).toHaveLength(1)
  return stringLiterals(
    parseTypeScript(`${fileName}:${variableName}`, `const extractedInitializer = ${initializerTexts[0]}`)
  )
}

const sortStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  Arr.sort(Arr.fromIterable(values), Order.string)

const algorithmsOf = (supportMatrix: ReadonlyArray<{ readonly algorithm: string }>): ReadonlyArray<string> =>
  sortStrings(supportMatrix.map(({ algorithm }) => algorithm))

describe("package/algorithm-matrix", () => {
  it.effect("keeps README tables, schema literals, dispatch surfaces, and the canonical support matrix aligned", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)
      const signSource = yield* fileSystem.readFileString(path.join(root, "src/sign.ts")).pipe(Effect.orDie)
      const agreementSource = yield* fileSystem.readFileString(path.join(root, "src/agreement.ts")).pipe(Effect.orDie)
      const kemSource = yield* fileSystem.readFileString(path.join(root, "src/kem.ts")).pipe(Effect.orDie)
      const keyPairSource = yield* fileSystem.readFileString(path.join(root, "src/keyPair.ts")).pipe(Effect.orDie)
      const signatureAlgorithmSource = yield* fileSystem
        .readFileString(path.join(root, "src/schemas/SignatureAlgorithm.ts"))
        .pipe(Effect.orDie)
      const agreementAlgorithmSource = yield* fileSystem
        .readFileString(path.join(root, "src/schemas/AgreementAlgorithm.ts"))
        .pipe(Effect.orDie)
      const kemAlgorithmSource = yield* fileSystem
        .readFileString(path.join(root, "src/schemas/KemAlgorithm.ts"))
        .pipe(Effect.orDie)

      const signatureAlgorithms = algorithmsOf(SignatureSupportMatrix)
      const agreementAlgorithms = algorithmsOf(AgreementSupportMatrix)
      const kemAlgorithms = algorithmsOf(KemSupportMatrix)
      const fullMatrixAlgorithms = algorithmsOf(AlgorithmSupportMatrix)

      expect(AlgorithmSupportMatrix).toEqual([
        ...SignatureSupportMatrix,
        ...AgreementSupportMatrix,
        ...KemSupportMatrix
      ])

      expect(
        SignatureSupportMatrix.map(({ algorithm }) =>
          Either.isRight(Schema.decodeUnknownEither(SignatureAlgorithm)(algorithm))
        )
      ).not.toContain(false)
      expect(
        AgreementSupportMatrix.map(({ algorithm }) =>
          Either.isRight(Schema.decodeUnknownEither(AgreementAlgorithm)(algorithm))
        )
      ).not.toContain(false)
      expect(
        KemSupportMatrix.map(({ algorithm }) => Either.isRight(Schema.decodeUnknownEither(KemAlgorithm)(algorithm)))
      ).not.toContain(false)

      expect(
        sortStrings(initializerStringLiterals("SignatureAlgorithm.ts", signatureAlgorithmSource, "SignatureAlgorithm"))
      ).toEqual(signatureAlgorithms)
      expect(
        sortStrings(initializerStringLiterals("AgreementAlgorithm.ts", agreementAlgorithmSource, "AgreementAlgorithm"))
      ).toEqual(agreementAlgorithms)
      expect(sortStrings(initializerStringLiterals("KemAlgorithm.ts", kemAlgorithmSource, "KemAlgorithm"))).toEqual(
        kemAlgorithms
      )

      expect(sortStrings(initializerStringLiterals("sign.ts", signSource, "sign"))).toEqual(signatureAlgorithms)
      expect(sortStrings(initializerStringLiterals("sign.ts", signSource, "verify"))).toEqual(signatureAlgorithms)
      expect(
        sortStrings(initializerStringLiterals("agreement.ts", agreementSource, "deriveSharedSecret"))
      ).toEqual(agreementAlgorithms)
      expect(sortStrings(initializerStringLiterals("kem.ts", kemSource, "encapsulate"))).toEqual(kemAlgorithms)
      expect(sortStrings(initializerStringLiterals("kem.ts", kemSource, "decapsulate"))).toEqual(kemAlgorithms)
      expect(sortStrings(initializerStringLiterals("keyPair.ts", keyPairSource, "generateKeyPair"))).toEqual(
        fullMatrixAlgorithms
      )

      expect(AlgorithmSupportMatrix.map(({ releaseStatus }) => releaseStatus)).not.toContain("experimental")
      expect(AlgorithmSupportMatrix.map(({ standard }) => readme.includes(standard))).not.toContain(false)
      expect(AlgorithmSupportMatrix.map(({ algorithm }) => readme.includes(`\`${algorithm}\``))).not.toContain(false)
    }).pipe(Effect.provide(BunContext.layer)))
})
