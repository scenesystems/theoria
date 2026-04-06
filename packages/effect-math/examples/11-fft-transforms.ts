/**
 * FFT — real-signal spectra, round trips, and circular convolution.
 *
 * The FFT domain keeps `Chunk<number>` as the dense carrier while exposing
 * Hermitian real-spectrum transforms and circular convolution. Boundary-
 * validated entrypoints decode canonical payloads, and policy-aware
 * entrypoints route through the shared computation-dispatch lane before
 * precision and diagnostics guards run.
 *
 * What this shows: pure `rfft` / `irfft` / `circularConvolution`,
 * boundary-validated `rfftValidated` / `circularConvolutionValidated`, and
 * policy-aware `rfftWithPolicies` / `circularConvolutionWithPolicies`.
 *
 * Run: bun run packages/effect-math/examples/11-fft-transforms.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"
import {
  circularConvolution,
  circularConvolutionValidated,
  circularConvolutionWithPolicies,
  irfft,
  rfft,
  rfftValidated,
  rfftWithPolicies
} from "effect-math/Fft"

const signal = Chunk.fromIterable([0, 1, 0, -1])
const kernel = Chunk.fromIterable([1, 0, -1, 0])

const program = Effect.gen(function*() {
  const spectrum = rfft(signal)
  yield* Console.log("rfft signalLength:", spectrum.signalLength)
  yield* Console.log("rfft real:", Chunk.toReadonlyArray(spectrum.real))
  yield* Console.log("rfft imaginary:", Chunk.toReadonlyArray(spectrum.imaginary))

  const roundTrip = irfft(spectrum)
  yield* Console.log("irfft round trip:", Chunk.toReadonlyArray(roundTrip))

  const convolution = circularConvolution(signal, kernel)
  yield* Console.log("circularConvolution:", Chunk.toReadonlyArray(convolution))

  const validatedSpectrum = yield* rfftValidated({
    values: [0, 1, 0, -1],
    normalization: "ortho"
  })
  yield* Console.log("rfftValidated signalLength:", validatedSpectrum.signalLength)

  const validatedConvolution = yield* circularConvolutionValidated({
    left: [0, 1, 0, -1],
    right: [1, 0, -1, 0],
    normalization: "backward"
  })
  yield* Console.log("circularConvolutionValidated:", Chunk.toReadonlyArray(validatedConvolution))

  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
    precision: "strict",
    backend: "typed-array",
    diagnostics: "disabled"
  })

  const policySpectrum = yield* rfftWithPolicies(signal).pipe(Effect.provide(policies))
  yield* Console.log("rfftWithPolicies real:", Chunk.toReadonlyArray(policySpectrum.real))

  const policyConvolution = yield* circularConvolutionWithPolicies(signal, kernel).pipe(
    Effect.provide(policies)
  )
  yield* Console.log("circularConvolutionWithPolicies:", Chunk.toReadonlyArray(policyConvolution))
})

BunRuntime.runMain(program)
