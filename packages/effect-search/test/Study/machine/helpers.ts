import { Effect } from "effect"

import * as Sampler from "../../../src/Sampler/index.js"
import * as SearchSpace from "../../../src/SearchSpace/index.js"
import { normalizeSettings } from "../../../src/Study/options.js"

const machineSpace = SearchSpace.unsafeMake({
  x: SearchSpace.float(-1, 1),
  depth: SearchSpace.int(1, 3)
})

export const machineSettings = normalizeSettings({
  space: machineSpace,
  sampler: Sampler.random({ seed: 17 }),
  direction: "minimize",
  trials: 3,
  objective: () => Effect.succeed(0)
})
