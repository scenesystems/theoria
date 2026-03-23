import { Data } from "effect"

export class MultivariateContinuousTrace extends Data.Class<{
  readonly parameterNames: ReadonlyArray<string>
  readonly candidateConfigs: ReadonlyArray<unknown>
  readonly logL: ReadonlyArray<number>
  readonly logG: ReadonlyArray<number>
  readonly scores: ReadonlyArray<number>
}> {}
