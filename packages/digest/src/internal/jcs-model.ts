/** State and frame model for the cooperative JCS machine. @internal */

import type { MutableHashSet } from "effect"
import { Data, MutableList, MutableRef, Option } from "effect"

import type { CanonicalizationError } from "../schemas/errors.js"
import type { Container, Snapshot } from "./admission.js"

export const SEGMENT = 32 * 1024
export type Ref<A> = MutableRef.MutableRef<A>

export type Frame =
  | { readonly _tag: "Visit"; readonly value: unknown }
  | {
    readonly _tag: "Symbols"
    readonly container: Container
    readonly keys: ReadonlyArray<PropertyKey>
    readonly at: Ref<number>
  }
  | {
    readonly _tag: "Descriptors"
    readonly container: Container
    readonly keys: ReadonlyArray<PropertyKey>
    readonly entries: Array<Snapshot>
    readonly at: Ref<number>
    readonly accessor: Ref<boolean>
    readonly hidden: Ref<boolean>
    readonly length: Ref<Option.Option<number>>
  }
  | {
    readonly _tag: "ArrayCheck"
    readonly identity: object
    readonly entries: Array<Snapshot>
    readonly length: number
    readonly at: Ref<number>
    readonly count: Ref<number>
    readonly hidden: Ref<boolean>
  }
  | {
    readonly _tag: "ArrayFill"
    readonly identity: object
    readonly entries: Array<Snapshot>
    readonly values: Array<unknown>
    readonly length: number
    readonly at: Ref<number>
  }
  | {
    readonly _tag: "Sort"
    readonly identity: object
    readonly entries: Array<Snapshot>
    readonly buffer: Array<Snapshot>
    readonly source: Ref<Array<Snapshot>>
    readonly target: Ref<Array<Snapshot>>
    readonly width: Ref<number>
    readonly left: Ref<number>
    readonly i: Ref<number>
    readonly j: Ref<number>
    readonly k: Ref<number>
  }
  | {
    readonly _tag: "Keys"
    readonly identity: object
    readonly entries: Array<Snapshot>
    readonly entry: Ref<number>
    readonly code: Ref<number>
  }
  | {
    readonly _tag: "ArrayCursor"
    readonly identity: object
    readonly values: ReadonlyArray<unknown>
    readonly at: Ref<number>
  }
  | {
    readonly _tag: "RecordCursor"
    readonly identity: object
    readonly entries: ReadonlyArray<Snapshot>
    readonly at: Ref<number>
  }
  | { readonly _tag: "String"; readonly text: string; readonly at: Ref<number>; readonly suffix: string }
  | { readonly _tag: "Close"; readonly identity: object; readonly token: "]" | "}" }

export class State extends Data.Class<{
  readonly stack: MutableList.MutableList<Frame>
  readonly active: MutableHashSet.MutableHashSet<object>
  readonly segments: MutableList.MutableList<string>
  readonly pending: Ref<string>
  readonly failure: Ref<Option.Option<CanonicalizationError>>
}> {}

export const ref = <A>(value: A): Ref<A> => MutableRef.make(value)
export const push = (state: State, frame: Frame): void => void MutableList.prepend(state.stack, frame)
export const fail = (state: State, error: CanonicalizationError): void =>
  void MutableRef.set(state.failure, Option.some(error))
export const emit = (state: State, text: string): void => {
  const pending = MutableRef.get(state.pending)
  if (pending.length > 0 && pending.length + text.length > SEGMENT) {
    MutableList.append(state.segments, pending)
    MutableRef.set(state.pending, text)
  } else MutableRef.set(state.pending, pending + text)
}

export const indexBelow = (key: string, length: number): boolean => {
  const index = Number(key)
  return Number.isInteger(index) && index >= 0 && index < length && `${index}` === key
}
