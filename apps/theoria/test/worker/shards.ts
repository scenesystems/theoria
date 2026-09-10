import { Data, Option, Schema, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Order from "effect/Order"

/**
 * One runner's share of a serial test suite, named as on the vitest command
 * line: `--shard=index/count`, the index one-based.
 */
export const Shard = Schema.Struct({
  index: Schema.Int.pipe(Schema.positive()),
  count: Schema.Int.pipe(Schema.positive())
})
export type Shard = typeof Shard.Type

/** A shard as it is filled: the files in it and the weight they add up to. */
class Bin<A> extends Data.Class<{
  readonly total: number
  readonly files: ReadonlyArray<A>
}> {
  static readonly empty = <A>(): Bin<A> => new Bin<A>({ total: 0, files: [] })
  with(file: A, weight: number): Bin<A> {
    return new Bin<A>({ total: this.total + weight, files: Arr.append(this.files, file) })
  }
}

/** The index of the first bin that is no heavier than any other. */
const lightestIndex = <A>(bins: ReadonlyArray<Bin<A>>): number =>
  Arr.reduce(
    bins,
    Tuple.make(0, Number.POSITIVE_INFINITY),
    (lightest, bin, index) => bin.total < Tuple.getSecond(lightest) ? Tuple.make(index, bin.total) : lightest
  )[0]

/**
 * Cuts the files into `count` shards of about one weight each: the heaviest
 * file first, each file into the lightest shard so far. Files whose serial
 * runtime is the weight then finish in about the same time on every runner,
 * and no shard is heavier than the fair share by more than one file. Files of
 * one weight are ordered by key, so the cut is a function of the files, not
 * of the order they were found in. A shard may be empty when there are more
 * shards than files.
 */
export const balancedShards = <A>(
  files: ReadonlyArray<A>,
  count: number,
  weightOf: (file: A) => number,
  keyOf: (file: A) => string
): ReadonlyArray<ReadonlyArray<A>> => {
  const heaviestFirst = Order.combine(
    Order.reverse(Order.mapInput(Order.number, weightOf)),
    Order.mapInput(Order.string, keyOf)
  )
  const empty: ReadonlyArray<Bin<A>> = Arr.makeBy(count, Bin.empty<A>)
  const filled = Arr.reduce(
    Arr.sort(files, heaviestFirst),
    empty,
    (bins, file) => Arr.modify(bins, lightestIndex(bins), (bin) => bin.with(file, weightOf(file)))
  )
  return Arr.map(filled, (bin) => bin.files)
}

/** The files of the one shard asked for, out of the balanced cut of them all. */
export const shardOf = <A>(
  files: ReadonlyArray<A>,
  shard: Shard,
  weightOf: (file: A) => number,
  keyOf: (file: A) => string
): ReadonlyArray<A> =>
  Option.getOrElse(Arr.get(balancedShards(files, shard.count, weightOf, keyOf), shard.index - 1), () => Arr.empty())
