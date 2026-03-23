import { Chunk } from "effect"

export const polynomial = (coefficients: Chunk.Chunk<number>, x: number): number =>
  Chunk.reduceRight(coefficients, 0, (total, coefficient) => total * x + coefficient)
