/**
 * Reproducible CPython and NumPy legacy pseudorandom streams with portable state.
 * These algorithms are for statistical sampling, never cryptographic material.
 * @since 0.6.0
 * @module
 */
import { Array, BigInt, Boolean, Chunk, Data, Effect, Number, Ref, Schema, Tuple } from "effect"
import * as CPythonSampling from "./internal/pseudoRandom/cpython.js"
import * as MT from "./internal/pseudoRandom/mersenneTwister.js"
import * as NumPySampling from "./internal/pseudoRandom/numpyLegacy.js"
import * as Numeric from "./Numeric.js"

/** MT19937 state, independent of the seed algorithm and suitable for checkpoints.
 * @since 0.6.0
 * @category models
 */
export class State extends Schema.Class<State>("@scenesystems/effect-math/PseudoRandom/State")({
  words: Schema.Chunk(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 4294967295 }))).check(
    Schema.isBetweenLength(624, 624)
  ),
  index: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 624 }))
}) {}

/** A distribution argument outside its mathematical domain.
 * @since 0.6.0
 * @category errors
 */
export class InvalidArgument extends Data.TaggedError("PseudoRandomInvalidArgument")<{ readonly message: string }> {}

const nonnegativeInteger = Schema.is(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)))
const integer = Schema.is(Schema.Int)
const check = (valid: boolean, message: string) =>
  Effect.succeed(valid).pipe(
    Effect.filterOrFail((value) => value, () => new InvalidArgument({ message })),
    Effect.asVoid
  )

const transitionState = (state: State) => new MT.State({ words: Array.fromIterable(state.words), index: state.index })
const portableState = (state: MT.State) => new State({ words: Chunk.fromIterable(state.words), index: state.index })
const step = <A>(ref: Ref.Ref<MT.State>, transition: (state: MT.State) => MT.Draw<A>): Effect.Effect<A> =>
  Ref.modify(ref, (state) => {
    const draw = transition(state)
    return Tuple.make(draw.value, draw.state)
  })

/** CPython Random integer seeding and rejection-based sequence sampling.
 *
 * Each operation consumes one atomic transition of this independent stream.
 * `Validated` forms check CPython's argument domain before drawing and fail
 * with {@link InvalidArgument}: positive `randbelow` bounds, integer `randint`
 * bounds with `a <= b`, nonempty `choice` populations, nonnegative integer
 * `getrandbits` widths and integer `sample` sizes with `0 <= k <= size`.
 * The base forms are for trusted arguments; a violated precondition is a
 * defect carrying the same {@link InvalidArgument}, raised before any draw.
 * Neither form consumes randomness when it rejects its arguments, and both
 * produce identical values for valid arguments.
 * @since 0.6.0
 * @category models
 */
export class CPython {
  private readonly state: Ref.Ref<MT.State>
  /** Continues an independent stream from a captured or decoded checkpoint. */
  constructor(state: State) {
    this.state = Ref.makeUnsafe(transitionState(state))
  }
  /** Captures state without consuming randomness. */
  get snapshot(): Effect.Effect<State> {
    return Ref.get(this.state).pipe(Effect.map(portableState))
  }
  /** Restores a decoded or previously captured checkpoint. */
  restore(state: State): Effect.Effect<void> {
    return Ref.set(this.state, transitionState(state))
  }
  random(): Effect.Effect<number> {
    return step(this.state, MT.random)
  }
  getrandbitsValidated(k: number): Effect.Effect<bigint, InvalidArgument> {
    return check(nonnegativeInteger(k), "number of bits must be a nonnegative integer").pipe(
      Effect.andThen(step(this.state, (state) => CPythonSampling.getrandbits(state, k)))
    )
  }
  getrandbits(k: number): Effect.Effect<bigint> {
    return Effect.orDie(this.getrandbitsValidated(k))
  }
  randbelowValidated(n: bigint): Effect.Effect<bigint, InvalidArgument> {
    return check(BigInt.isGreaterThan(n, 0n), "randbelow requires a positive bound").pipe(
      Effect.andThen(step(this.state, (state) => CPythonSampling.randbelow(state, n)))
    )
  }
  randbelow(n: bigint): Effect.Effect<bigint> {
    return Effect.orDie(this.randbelowValidated(n))
  }
  randintValidated(a: number, b: number): Effect.Effect<number, InvalidArgument> {
    return check(
      Boolean.and(Boolean.and(integer(a), integer(b)), Number.isLessThanOrEqualTo(a, b)),
      "randint requires integer bounds with a <= b"
    ).pipe(Effect.andThen(step(this.state, (state) => CPythonSampling.randint(state, a, b))))
  }
  randint(a: number, b: number): Effect.Effect<number> {
    return Effect.orDie(this.randintValidated(a, b))
  }
  choiceValidated<A>(values: Chunk.Chunk<A>): Effect.Effect<A, InvalidArgument> {
    return check(Chunk.isNonEmpty(values), "cannot choose from an empty population").pipe(
      Effect.andThen(step(this.state, (state) => CPythonSampling.choice(state, Array.fromIterable(values))))
    )
  }
  choice<A>(values: Chunk.Chunk<A>): Effect.Effect<A> {
    return Effect.orDie(this.choiceValidated(values))
  }
  shuffle<A>(values: Chunk.Chunk<A>): Effect.Effect<Chunk.Chunk<A>> {
    return step(this.state, (state) => CPythonSampling.shuffle(state, Array.fromIterable(values))).pipe(
      Effect.map(Chunk.fromIterable)
    )
  }
  sampleValidated<A>(values: Chunk.Chunk<A>, k: number): Effect.Effect<Chunk.Chunk<A>, InvalidArgument> {
    return check(
      Boolean.and(nonnegativeInteger(k), Number.isLessThanOrEqualTo(k, Chunk.size(values))),
      "sample size must be an integer between 0 and the population size"
    ).pipe(
      Effect.andThen(step(this.state, (state) => CPythonSampling.sample(state, Array.fromIterable(values), k))),
      Effect.map(Chunk.fromIterable)
    )
  }
  sample<A>(values: Chunk.Chunk<A>, k: number): Effect.Effect<Chunk.Chunk<A>> {
    return Effect.orDie(this.sampleValidated(values, k))
  }
}

/** NumPy RandomState's frozen random_sample, rand, uniform and weighted choice.
 * Batches are flattened in C order; choice samples with replacement.
 * @since 0.6.0
 * @category models
 */
export class NumPyLegacy {
  private readonly state: Ref.Ref<MT.State>
  /** Continues an independent stream from a captured or decoded checkpoint. */
  constructor(state: State) {
    this.state = Ref.makeUnsafe(transitionState(state))
  }
  /** Captures state without consuming randomness. */
  get snapshot(): Effect.Effect<State> {
    return Ref.get(this.state).pipe(Effect.map(portableState))
  }
  /** Restores a decoded or previously captured checkpoint. */
  restore(state: State): Effect.Effect<void> {
    return Ref.set(this.state, transitionState(state))
  }
  randomSample(): Effect.Effect<number> {
    return step(this.state, MT.random)
  }
  rand(size: number) {
    return this.uniform(0, 1, size)
  }
  uniform(low: number, high: number, size: number) {
    return check(nonnegativeInteger(size), "size must be a nonnegative integer").pipe(
      Effect.andThen(() => step(this.state, (state) => NumPySampling.uniform(state, low, high, size))),
      Effect.map(Chunk.fromIterable)
    )
  }
  choice(n: number, p: Chunk.Chunk<number>, size: number) {
    const values = Array.fromIterable(p)
    return Effect.gen({ self: this }, function*() {
      yield* check(nonnegativeInteger(size), "size must be a nonnegative integer")
      yield* check(
        Boolean.and(Number.isGreaterThan(n, 0), Number.Equivalence(values.length, n)),
        "p must match the positive population size"
      )
      yield* check(
        Array.every(values, Schema.is(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)))),
        "probabilities must be finite and nonnegative"
      )
      yield* check(
        Number.isLessThanOrEqualTo(
          Numeric.abs(Number.subtract(NumPySampling.kahanSum(values), 1)),
          1.4901161193847656e-8
        ),
        "probabilities do not sum to 1"
      )
      return Chunk.fromIterable(yield* step(this.state, (state) => NumPySampling.choice(state, values, size)))
    })
  }
}

/** Constructs an independent stream from a trusted integer seed of either sign.
 * @since 0.6.0
 * @category constructors
 */
export const makeCPython = (seed: number | bigint): Effect.Effect<CPython> =>
  Effect.sync(() => new CPython(portableState(CPythonSampling.seed(seed))))

/** Constructs an independent legacy stream; rejects seeds outside uint32.
 * @since 0.6.0
 * @category constructors
 */
export const makeNumPyLegacy = (seed: number): Effect.Effect<NumPyLegacy, InvalidArgument> =>
  check(
    Schema.is(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 4294967295 })))(seed),
    "seed must be an integer between 0 and 2**32 - 1"
  ).pipe(
    Effect.andThen(Effect.sync(() => new NumPyLegacy(portableState(MT.initGenrand(seed)))))
  )
