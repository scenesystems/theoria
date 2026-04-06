import { Chunk } from "effect"
import * as Arr from "effect/Array"

export const circularConvolutionKernel = (
  left: Chunk.Chunk<number>,
  right: Chunk.Chunk<number>
): Chunk.Chunk<number> => {
  const leftValues = Chunk.toReadonlyArray(left)
  const rightValues = Chunk.toReadonlyArray(right)
  const size = leftValues.length

  return Chunk.fromIterable(
    Arr.map(Arr.range(0, size - 1), (outputIndex) =>
      leftValues.reduce(
        (total, value, index) => total + value * rightValues[(outputIndex - index + size) % size]!,
        0
      ))
  )
}
