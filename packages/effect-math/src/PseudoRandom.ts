/**
 * Reproducible CPython and NumPy legacy pseudorandom streams with portable state.
 * These algorithms are for statistical sampling, never cryptographic material.
 * @since 0.6.0
 * @module
 */
import { Array, Boolean, Chunk, Data, Effect, Number, Ref, Schema, Tuple } from "effect"
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
const check = (valid: boolean, message: string) =>
  Effect.succeed(valid).pipe(
    Effect.filterOrFail((value) => value, () => new InvalidArgument({ message })),
    Effect.asVoid
  )

class Generator {
  constructor(private readonly state: Ref.Ref<MT.State>) {}
  protected draw<A>(transition: (state: MT.State) => MT.Draw<A>): Effect.Effect<A> {
    return Ref.modify(this.state, (state) => {
      const draw = transition(state)
      return Tuple.make(draw.value, draw.state)
    })
  }
  /** Captures state without consuming randomness. */
  get snapshot(): Effect.Effect<State> {
    return Ref.get(this.state).pipe(
      Effect.map((state) => new State({ words: Chunk.fromIterable(state.words), index: state.index }))
    )
  }
  /** Restores a decoded or previously captured checkpoint. */
  restore(state: State): Effect.Effect<void> {
    return Ref.set(this.state, new MT.State({ words: Array.fromIterable(state.words), index: state.index }))
  }
}

/** CPython Random integer seeding and rejection-based sequence sampling.
 * Arguments are trusted: integer bounds, nonempty choices, and 0 <= k <= size.
 * Each operation consumes one atomic transition of this independent stream.
 * @since 0.6.0
 * @category models
 */
export class CPython extends Generator {
  random() {
    return this.draw(MT.random)
  }
  getrandbits(k: number) {
    return this.draw((state) => CPythonSampling.getrandbits(state, k))
  }
  randbelow(n: bigint) {
    return this.draw((state) => CPythonSampling.randbelow(state, n))
  }
  randint(a: number, b: number) {
    return this.draw((state) => CPythonSampling.randint(state, a, b))
  }
  choice<A>(values: Chunk.Chunk<A>) {
    return this.draw((state) => CPythonSampling.choice(state, Array.fromIterable(values)))
  }
  shuffle<A>(values: Chunk.Chunk<A>) {
    return this.draw((state) => CPythonSampling.shuffle(state, Array.fromIterable(values))).pipe(
      Effect.map(Chunk.fromIterable)
    )
  }
  sample<A>(values: Chunk.Chunk<A>, k: number) {
    return this.draw((state) => CPythonSampling.sample(state, Array.fromIterable(values), k)).pipe(
      Effect.map(Chunk.fromIterable)
    )
  }
}

/** NumPy RandomState's frozen random_sample, rand, uniform and weighted choice.
 * Batches are flattened in C order; choice samples with replacement.
 * @since 0.6.0
 * @category models
 */
export class NumPyLegacy extends Generator {
  randomSample() {
    return this.draw(MT.random)
  }
  rand(size: number) {
    return this.uniform(0, 1, size)
  }
  uniform(low: number, high: number, size: number) {
    return check(nonnegativeInteger(size), "size must be a nonnegative integer").pipe(
      Effect.andThen(() => this.draw((state) => NumPySampling.uniform(state, low, high, size))),
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
      return Chunk.fromIterable(yield* this.draw((state) => NumPySampling.choice(state, values, size)))
    })
  }
}

/** Constructs an independent stream from a trusted integer seed of either sign.
 * @since 0.6.0
 * @category constructors
 */
export const makeCPython = (seed: number | bigint): Effect.Effect<CPython> =>
  Ref.make(CPythonSampling.seed(seed)).pipe(Effect.map((state) => new CPython(state)))

/** Constructs an independent legacy stream; rejects seeds outside uint32.
 * @since 0.6.0
 * @category constructors
 */
export const makeNumPyLegacy = (seed: number): Effect.Effect<NumPyLegacy, InvalidArgument> =>
  check(
    Schema.is(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 4294967295 })))(seed),
    "seed must be an integer between 0 and 2**32 - 1"
  ).pipe(
    Effect.andThen(() => Ref.make(MT.initGenrand(seed))),
    Effect.map((state) => new NumPyLegacy(state))
  )
