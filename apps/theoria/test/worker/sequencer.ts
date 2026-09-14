import { Option } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"
import { BaseSequencer, type TestSequencer, type TestSpecification, type Vitest } from "vitest/node"

import { shardOf } from "./shards.js"

/**
 * The stats key vitest files a specification's size under: the project's name
 * and the module's path from the root, as `BaseSequencer.sort` reads it.
 */
const statsKey = (root: string, spec: TestSpecification): string => {
  const under = `${root}/`
  const path = Str.startsWith(under)(spec.moduleId) ? Str.slice(under.length)(spec.moduleId) : spec.moduleId
  return `${spec.project.name}:${path}`
}

/**
 * Cuts the Chromium suite into shards of about one runtime each.
 *
 * The files run serially within a shard, so a shard takes as long as its files
 * together; vitest's own `--shard` cuts the list by path hash and puts no bound
 * on that. This sequencer weighs each file by its size — the proxy vitest's own
 * `sort` reaches for when no run has been cached — and hands the heaviest files
 * out first, each to the lightest shard so far. The sizes are the ones vitest
 * gathered before sequencing; a file it has none for weighs nothing and is
 * placed after the rest. Sorting within a shard stays vitest's.
 */
export class BalancedSequencer implements TestSequencer {
  /** Vitest's own sequencer, which still orders the files within the shard. */
  readonly #base: BaseSequencer

  constructor(private readonly ctx: Vitest) {
    this.#base = new BaseSequencer(ctx)
  }

  shard(files: Array<TestSpecification>): Array<TestSpecification> {
    const { root, shard } = this.ctx.config
    return Option.match(Option.fromNullable(shard), {
      onNone: () => files,
      onSome: (shard) => {
        const weightOf = (spec: TestSpecification): number =>
          Option.match(Option.fromNullable(this.ctx.cache.getFileStats(statsKey(root, spec))), {
            onNone: () => 0,
            onSome: (stats) => stats.size
          })
        return Arr.copy(shardOf(files, shard, weightOf, (spec) => statsKey(root, spec)))
      }
    })
  }

  sort(files: Array<TestSpecification>): Promise<Array<TestSpecification>> {
    return this.#base.sort(files)
  }
}
