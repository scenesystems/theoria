import { Chunk, Number as N } from "effect"

import { dft, zeroChunk } from "./core.js"

export const circularConvolutionKernel = (
  left: Chunk.Chunk<number>,
  right: Chunk.Chunk<number>
): Chunk.Chunk<number> => {
  const leftSpectrum = dft({
    real: left,
    imaginary: zeroChunk(Chunk.size(left)),
    normalization: "backward",
    direction: "forward"
  })
  const rightSpectrum = dft({
    real: right,
    imaginary: zeroChunk(Chunk.size(right)),
    normalization: "backward",
    direction: "forward"
  })
  const product = leftSpectrum.map((value, index) => ({
    real: N.subtract(
      N.multiply(value.real, rightSpectrum[index]!.real),
      N.multiply(value.imaginary, rightSpectrum[index]!.imaginary)
    ),
    imaginary: N.sum(
      N.multiply(value.real, rightSpectrum[index]!.imaginary),
      N.multiply(value.imaginary, rightSpectrum[index]!.real)
    )
  }))
  const result = dft({
    real: Chunk.fromIterable(product.map((value) => value.real)),
    imaginary: Chunk.fromIterable(product.map((value) => value.imaginary)),
    normalization: "backward",
    direction: "inverse"
  })

  return Chunk.fromIterable(result.map((value) => value.real))
}
