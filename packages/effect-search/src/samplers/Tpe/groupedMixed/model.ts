import { Data } from "effect"

export class GroupedMixedSettings extends Data.Class<{
  readonly multivariate: boolean
  readonly groupDimensions: boolean
}> {}
