/**
 * Active-path and compaction resolution helpers for migrated `pi` sessions.
 *
 * @since 0.2.0
 */
import { Array as Arr, HashMap, Option } from "effect"
import type { PiSessionEntry } from "../schema.js"
import { OpenAgentTraceBranch, OpenAgentTraceSelection } from "../schema.js"

const entryById = (entries: ReadonlyArray<PiSessionEntry>) =>
  Arr.reduce(
    entries,
    HashMap.empty<string, PiSessionEntry>(),
    (accumulator, entry) => HashMap.set(accumulator, entry.id, entry)
  )

const latestLeaf = (entries: ReadonlyArray<PiSessionEntry>) =>
  Arr.last(entries).pipe(Option.getOrElse(() => entries[0]!))

const activePath = (entries: ReadonlyArray<PiSessionEntry>, selectedLeafEntryId: string) => {
  const byId = entryById(entries)

  const walk = (entryId: string | null, path: ReadonlyArray<PiSessionEntry>): ReadonlyArray<PiSessionEntry> => {
    if (entryId === null) {
      return path
    }

    return Option.match(HashMap.get(byId, entryId), {
      onNone: () => path,
      onSome: (entry) => walk(entry.parentId, [entry, ...path])
    })
  }

  return walk(selectedLeafEntryId, [])
}

const liveContextEntries = (path: ReadonlyArray<PiSessionEntry>) => {
  const contextVisibleEntries = (entries: ReadonlyArray<PiSessionEntry>) =>
    entries.filter((entry) => entry.type !== "custom")
  const latestCompaction = Arr.last(path.filter((entry) => entry.type === "compaction"))

  return Option.match(latestCompaction, {
    onNone: () => contextVisibleEntries(path),
    onSome: (compaction) => {
      const firstKeptIndex = path.findIndex((entry) => entry.id === compaction.firstKeptEntryId)
      const retainedEntries = path.filter((entry) => {
        const entryIndex = path.findIndex((candidate) => candidate.id === entry.id)

        return entryIndex >= firstKeptIndex && entry.id !== compaction.id
      })

      return contextVisibleEntries([compaction, ...retainedEntries])
    }
  })
}

const branchSummaries = (entries: ReadonlyArray<PiSessionEntry>) =>
  entries
    .filter((entry) => entry.type === "branch_summary")
    .map(
      (entry) =>
        new OpenAgentTraceBranch({
          branchId: entry.id,
          parentBranchId: entry.parentId ?? undefined,
          leafEntryId: entry.fromId,
          fromEntryId: entry.fromId,
          branchSummaryEntryId: entry.id,
          branchSummaryText: entry.summary
        })
    )

/**
 * Resolves one replay-safe `pi` active path and its branch-lineage summary surface.
 *
 * @since 0.2.0
 * @category combinators
 */
export const resolvePiSessionContext = (entries: ReadonlyArray<PiSessionEntry>) => {
  const selectedLeaf = latestLeaf(entries)
  const path = activePath(entries, selectedLeaf.id)
  const branches = branchSummaries(entries)

  return {
    selection: new OpenAgentTraceSelection({
      selectedLeafEntryId: selectedLeaf.id,
      selectionPolicy: "latest-leaf",
      activePathEntryIds: path.map((entry) => entry.id),
      compactedPathEntryIds: path.filter((entry) => entry.type === "compaction").map((entry) => entry.id),
      abandonedBranchRootIds: branches.map((branch) => branch.branchId)
    }),
    activePath: path,
    liveContext: liveContextEntries(path),
    branches
  }
}
