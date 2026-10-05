/** Invocation-local state for stack-safe canonical traversal. @internal */

import * as Data from "effect/Data"
import type * as MutableHashSet from "effect/MutableHashSet"
import * as MutableList from "effect/MutableList"
import * as MutableRef from "effect/MutableRef"
import * as N from "effect/Number"
import * as Option from "effect/Option"
import * as Str from "effect/String"

import type { Error as CanonicalizationError } from "../../CanonicalJson.js"

export type Frame = Data.TaggedEnum<{
  Visit: { readonly value: unknown }
  Array: { readonly identity: ReadonlyArray<unknown>; readonly at: MutableRef.MutableRef<number> }
  Record: {
    readonly identity: Readonly<Record<string, unknown>>
    readonly keys: ReadonlyArray<string>
    readonly at: MutableRef.MutableRef<number>
  }
  String: { readonly text: string; readonly at: number; readonly suffix: string }
  Close: { readonly identity: object; readonly token: string }
}>

export const Frame = Data.taggedEnum<Frame>()

export class State<E> extends Data.Class<{
  readonly stack: MutableList.MutableList<Frame>
  readonly active: MutableHashSet.MutableHashSet<number>
  readonly identity: (value: object) => number
  readonly segments: MutableList.MutableList<string>
  readonly write: (state: State<E>, text: string) => void
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
  if (Str.isNonEmpty(pending)) {
    MutableList.append(state.segments, pending)
    MutableRef.set(state.pending, "")
  }
}

export const append = <E>(state: State<E>, text: string): void => {
  MutableRef.set(state.pending, Str.ReducerConcat.combine(MutableRef.get(state.pending), text))
  if (N.isGreaterThanOrEqualTo(Str.length(MutableRef.get(state.pending)), 32_768)) flushPending(state)
}

export const emit = <E>(state: State<E>, text: string): void => state.write(state, text)
