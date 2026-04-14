import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, String as EffectString } from "effect"

import {
  decodeFftDomain,
  encodeFftDomain,
  fft,
  FftDomainContract,
  FftDomainModel,
  FftSequence,
  loadFftDomain,
  RealFftSpectrum
} from "../../src/Fft/index.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("Fft / domain contract", () => {
  it.effect("keeps contract, model, boundary schema, and loader aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFftDomain
      const decoded = yield* decodeFftDomain(FftDomainModel)

      expect(domainModelEq(loaded, FftDomainModel)).toStrictEqual(true)
      expect(domainModelEq(decoded, FftDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(FftDomainModel.domain, FftDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeFftDomain(FftDomainModel)
      const encoded = yield* encodeFftDomain(decoded)

      expect(domainModelEq(encoded, FftDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeFftDomain({
          domain: "Fft",
          stability: "invalid"
        })
      )

      expect(error._tag).toStrictEqual("BoundaryDecodeError")
      expect(error.domain).toStrictEqual("Fft")
      expect(error.contract).toStrictEqual("FftDomainSchema")
    }))

  it.effect("exports typed complex-sequence carriers", () =>
    Effect.gen(function*() {
      expect(typeof FftSequence).toStrictEqual("function")
      expect(typeof RealFftSpectrum).toStrictEqual("function")
      expect(typeof fft).toStrictEqual("function")
    }))
})
