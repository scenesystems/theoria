import { describe, expect, it } from "@effect/vitest"
import { Record } from "effect"
import packageJson from "../../package.json" with { type: "json" }

import {
  AgreementSupportMatrix,
  AlgorithmSupportMatrix,
  KemSupportMatrix,
  PortableCodecDecodeFailed,
  PortableKemCiphertext,
  PortableKeyPair,
  PortableSharedSecret,
  PortableSignature,
  SignatureSupportMatrix
} from "../../src/index.js"

describe("algorithm governance", () => {
  it("keeps proof assets on the root surface without leaking internal or helper-only modules", () => {
    expect(AlgorithmSupportMatrix.length).toBe(
      SignatureSupportMatrix.length + AgreementSupportMatrix.length + KemSupportMatrix.length
    )
    expect(PortableCodecDecodeFailed).toBeDefined()
    expect(PortableKeyPair).toBeDefined()
    expect(PortableSignature).toBeDefined()
    expect(PortableSharedSecret).toBeDefined()
    expect(PortableKemCiphertext).toBeDefined()
    expect(Record.keys(packageJson.exports)).toEqual(["."])
  })
})
