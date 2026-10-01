/**
 * Phase 2 diversity tip and cache-bust marker policies.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { buildIndices, normalizeDeterministicSeed, normalizePositiveCount } from "@scenesystems/effect-search/Sampler"
import { Array as Arr, Inspectable, Number as Num, Option } from "effect"
import type { Schema } from "effect"

type TipVocabulary = Schema.Array$<typeof Schema.String>["Type"]

/**
 * Built-in diversity tip vocabulary used when no custom tips are supplied.
 *
 * Each tip steers the meta-LLM toward a different instruction style:
 * `"none"` (unconstrained), `"creative"`, `"simple"`, `"description"`,
 * `"high_stakes"`, and `"persona"`.
 *
 * @since 0.1.0
 * @category constants
 */
export const defaultTipVocabulary = Arr.make(
  "none",
  "creative",
  "simple",
  "description",
  "high_stakes",
  "persona"
)

/**
 * Clamps an instruction candidate count to at least 1.
 *
 * @since 0.1.0
 * @category utils
 */
export const normalizeInstructionCount = (count: number): number => normalizePositiveCount(count)

/**
 * Resolves an optional seed to a deterministic positive integer, defaulting
 * to `1` when absent.
 *
 * @since 0.1.0
 * @category utils
 */
export const resolveSeed = (seed?: number): number =>
  normalizeDeterministicSeed(Option.getOrElse(Option.fromNullable(seed), () => 1))

/**
 * Produces zero-based indices for instruction proposals, excluding the
 * first slot which is reserved for the baseline instruction.
 *
 * @since 0.1.0
 * @category helpers
 */
export const proposalIndices = (
  requestedInstructionCount: number
): Schema.Array$<typeof Schema.Number>["Type"] =>
  buildIndices(Numeric.max(0, Num.subtract(normalizeInstructionCount(requestedInstructionCount), 1)))

/**
 * Returns the provided tip vocabulary when non-empty, otherwise falls back
 * to {@link defaultTipVocabulary}.
 *
 * @since 0.1.0
 * @category utils
 */
export const resolveTipVocabulary = (tipVocabulary?: TipVocabulary): TipVocabulary =>
  Option.getOrElse(
    Option.filter(Option.fromNullable(tipVocabulary), Arr.isNonEmptyReadonlyArray),
    () => defaultTipVocabulary
  )

/**
 * Selects a diversity tip by cycling through the vocabulary with modular
 * indexing. Returns `"none"` if the vocabulary is empty.
 *
 * @since 0.1.0
 * @category helpers
 */
export const tipAt = (tips: TipVocabulary, index: number): string =>
  Option.getOrElse(
    Arr.get(tips, Num.remainder(index, Arr.length(tips))),
    () => "none"
  )

/**
 * Builds a deterministic cache-bust marker embedded in each instruction
 * proposal prompt. Encodes the predictor name, proposal index, and seed so
 * the LLM treats each call as distinct.
 *
 * @since 0.1.0
 * @category helpers
 */
export const proposalMarker = (predictorName: string, proposalIndex: number, seed: number): string =>
  Arr.join(
    Arr.make(
      "[miprov2-proposal:",
      predictorName,
      ":",
      Inspectable.toStringUnknown(proposalIndex),
      ":seed:",
      Inspectable.toStringUnknown(seed),
      "]"
    ),
    ""
  )

/**
 * Resolves an optional diversity temperature, defaulting to `1` when
 * absent. Higher values encourage the meta-LLM to produce more varied
 * instruction proposals.
 *
 * @since 0.1.0
 * @category utils
 */
export const resolveDiversityTemperature = (temperature?: number): number =>
  Option.getOrElse(Option.fromNullable(temperature), () => 1)
