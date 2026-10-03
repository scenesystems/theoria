import { Number, Record, Schema, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Sampler from "@scenesystems/effect-search/Sampler"
import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"

import { renderSeed } from "./imagined-place-search.js"

/**
 * The optimization executed by the search worker and the server walkthrough.
 * Keep engine construction separate from the request codec consumed by the
 * main browser thread: decoding a meander does not require loading a sampler.
 */
const Bounds = Schema.Record(
  Schema.Literals(["edge", "swing", "phase", "turns", "top", "step"]),
  Schema.Tuple([
    Schema.Finite,
    Schema.Finite
  ])
)

export const meanderBounds = Bounds.make({
  edge: Tuple.make(0.5, 0.9),
  swing: Tuple.make(0, 0.3),
  phase: Tuple.make(Number.multiply(Numeric.pi, -1), Numeric.pi),
  turns: Tuple.make(0.5, 2.5),
  top: Tuple.make(0.04, 0.6),
  step: Tuple.make(0.03, 0.24)
})

export const meanderSpace = SearchSpace.make(Record.map(meanderBounds, ([low, high]) => SearchSpace.float(low, high)))

export const renderSampler = () => Sampler.tpe(new Sampler.TpeOptions({ seed: renderSeed }))
