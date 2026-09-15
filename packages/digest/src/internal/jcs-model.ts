/** Invocation-local state for stack-safe canonical traversal. @internal */

import type { MutableHashSet } from "effect"
import {
  Boolean as B,
  Data,
  Either,
  Equal,
  Equivalence,
  Hash,
  Match,
  MutableList,
  MutableRef,
  Number as N,
  Option,
  Schema,
  String as Str
} from "effect"

import type { CanonicalizationError } from "../schemas/errors.js"

const Sequence = Schema.Array(Schema.Unknown)
const Fields = Schema.Record({ key: Schema.String, value: Schema.Unknown })

/** Cycle detection compares input references, never their structural Hash/Equal implementations. */
export class Ancestor extends Data.Class<{ readonly identity: object }> {
  [Hash.symbol](): number {
    return Hash.random(this.identity)
  }

  [Equal.symbol](that: Equal.Equal): boolean {
    return Match.value(that).pipe(
      Match.when(
        Schema.is(Schema.instanceOf(Ancestor)),
        (other) => Equivalence.strict<object>()(this.identity, other.identity)
      ),
      Match.orElse(() => false)
    )
  }
}

const FrameSchema = Schema.Union(
  Schema.TaggedStruct("Visit", { value: Schema.Unknown }),
  Schema.TaggedStruct("Array", { identity: Sequence, at: Schema.Number }),
  Schema.TaggedStruct("Record", {
    identity: Fields,
    keys: Schema.ChunkFromSelf(Schema.String),
    at: Schema.Number
  }),
  Schema.TaggedStruct("String", { text: Schema.String, at: Schema.Number, suffix: Schema.String }),
  Schema.TaggedStruct("Close", { identity: Schema.Object, token: Schema.String })
)

export type Frame = typeof FrameSchema.Type

export const Frame = Data.taggedEnum<Frame>()

export class State<E> extends Data.Class<{
  readonly stack: MutableList.MutableList<Frame>
  readonly active: MutableHashSet.MutableHashSet<Ancestor>
  readonly segments: MutableList.MutableList<string>
  readonly sink: Option.Option<(segment: string) => void>
  readonly admit: (text: string) => Either.Either<void, E>
  readonly pending: MutableRef.MutableRef<string>
  readonly failure: MutableRef.MutableRef<Option.Option<CanonicalizationError | E>>
}> {}

export const fail = <E>(state: State<E>, error: CanonicalizationError | E): void => {
  MutableRef.set(state.failure, Option.some(error))
}

export const push = <E>(state: State<E>, frame: Frame): void => {
  MutableList.prepend(state.stack, frame)
}

export const flushPending = <E>(state: State<E>): void => {
  const pending = MutableRef.get(state.pending)
  B.match(Str.isNonEmpty(pending), {
    onFalse: () => undefined,
    onTrue: () => {
      Option.match(state.sink, {
        onNone: () => {
          MutableList.append(state.segments, pending)
        },
        onSome: (sink) => sink(pending)
      })
      MutableRef.set(state.pending, "")
    }
  })
}

export const emit = <E>(state: State<E>, text: string): void => {
  Either.match(state.admit(text), {
    onLeft: (error) => fail(state, error),
    onRight: () => {
      MutableRef.update(state.pending, Str.concat(text))
      B.match(N.greaterThanOrEqualTo(Str.length(MutableRef.get(state.pending)), 32_768), {
        onTrue: () => flushPending(state),
        onFalse: () => undefined
      })
    }
  })
}
