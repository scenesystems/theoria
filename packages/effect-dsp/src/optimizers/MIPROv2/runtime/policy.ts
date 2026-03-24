/**
 * Phase 2 diversity tip and cache-bust marker policies.
 *
 * @since 0.0.0
 * @internal
 */
import { Array as Arr, Option } from "effect"
import { buildIndices, normalizeCount, normalizeSeed } from "./random.js"

/**
 * Built-in diversity tip vocabulary used when no custom tips are supplied.
 *
 * Each tip steers the meta-LLM toward a different instruction style:
 * `"none"` (unconstrained), `"creative"`, `"simple"`, `"description"`,
 * `"high_stakes"`, and `"persona"`.
 *
 * @since 0.0.0
 * @category constants
 */
export const DEFAULT_TIP_VOCABULARY = Arr.make(
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
 * @since 0.0.0
 * @category utils
 */
export const normalizeInstructionCount = (count: number): number => normalizeCount(count)

/**
 * Resolves an optional seed to a deterministic positive integer, defaulting
 * to `1` when absent.
 *
 * @since 0.0.0
 * @category utils
 */
export const resolveSeed = (seed?: number): number =>
  normalizeSeed(Option.getOrElse(Option.fromNullable(seed), () => 1))

/**
 * Produces zero-based indices for instruction proposals, excluding the
 * first slot which is reserved for the baseline instruction.
 *
 * @since 0.0.0
 * @category helpers
 */
export const proposalIndices = (requestedInstructionCount: number): ReadonlyArray<number> =>
  buildIndices(Math.max(0, normalizeInstructionCount(requestedInstructionCount) - 1))

/**
 * Returns the provided tip vocabulary when non-empty, otherwise falls back
 * to {@link DEFAULT_TIP_VOCABULARY}.
 *
 * @since 0.0.0
 * @category utils
 */
export const resolveTipVocabulary = (tipVocabulary?: ReadonlyArray<string>): ReadonlyArray<string> =>
  Option.getOrElse(
    Option.filter(Option.fromNullable(tipVocabulary), (vocabulary) => vocabulary.length > 0),
    () => DEFAULT_TIP_VOCABULARY
  )

/**
 * Selects a diversity tip by cycling through the vocabulary with modular
 * indexing. Returns `"none"` if the vocabulary is empty.
 *
 * @since 0.0.0
 * @category helpers
 */
export const tipAt = (tips: ReadonlyArray<string>, index: number): string =>
  Option.getOrElse(
    Arr.get(tips, index % tips.length),
    () => "none"
  )

/**
 * Builds a deterministic cache-bust marker embedded in each instruction
 * proposal prompt. Encodes the predictor name, proposal index, and seed so
 * the LLM treats each call as distinct.
 *
 * @since 0.0.0
 * @category helpers
 */
export const proposalMarker = (predictorName: string, proposalIndex: number, seed: number): string =>
  `[miprov2-proposal:${predictorName}:${proposalIndex}:seed:${seed}]`

/**
 * Resolves an optional diversity temperature, defaulting to `1` when
 * absent. Higher values encourage the meta-LLM to produce more varied
 * instruction proposals.
 *
 * @since 0.0.0
 * @category utils
 */
export const resolveDiversityTemperature = (temperature?: number): number =>
  Option.getOrElse(Option.fromNullable(temperature), () => 1)
