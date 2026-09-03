import { Array as Arr, HashMap, HashSet, Order, String as Str } from "effect"
import type { ApiDocPart, ApiExport } from "@theoria/docs-model"

const PUBLIC_CATEGORIES = HashSet.make(
  "agreement",
  "algorithms",
  "annotations",
  "authentication",
  "cache",
  "canonicalization",
  "codecs",
  "combinators",
  "comparison",
  "constants",
  "constructors",
  "contracts",
  "decoders",
  "digest",
  "domains",
  "dominance",
  "encoding",
  "errors",
  "evaluation",
  "events",
  "experimental",
  "fingerprint",
  "formatters",
  "freshness",
  "frontier",
  "guards",
  "hypervolume",
  "identities",
  "kem",
  "key-derivation",
  "keys",
  "layers",
  "layout",
  "manifests",
  "metrics",
  "models",
  "modules",
  "operations",
  "optimizers",
  "parity",
  "pattern-matching",
  "projection",
  "readers",
  "refs",
  "runtime",
  "schemas",
  "seal",
  "services",
  "signatures",
  "signing",
  "sinks",
  "stability",
  "symbols",
  "testing",
  "tracing",
  "type-level",
  "validated operations"
)

export const categoryDiagnostic = (owner: string, category: string): string | undefined =>
  HashSet.has(PUBLIC_CATEGORIES, category) ? undefined : `${owner}: unsupported public category ${category}`

export const linkDiagnostics = (
  owner: string,
  parts: ReadonlyArray<ApiDocPart>,
  targets: HashSet.HashSet<string>
): ReadonlyArray<string> => Arr.flatMap(parts, (part) => {
  if (part.kind !== "link") return []
  if (part.href === null) return [`${owner}: authored link has no target`]
  if (/^https?:\/\//u.test(part.href)) return []
  if (!part.href.startsWith("/docs/")) return [`${owner}: unsupported link target ${part.href}`]
  return HashSet.has(targets, part.href) ? [] : [`${owner}: unresolved link ${part.href}`]
})

const PROHIBITED = [
  /\bthis (?:function|class|api)\b/iu,
  /\b(?:todo|roadmap|coming soon|will (?:eventually|soon))\b/iu,
  /\b(?:best-in-class|world-class|revolutionary|game-changing)\b/iu,
  /\b(?:barrel module|root entrypoint|public surface|model scaffold|contract authority|type-level extraction)\b/iu,
  /\b(?:extracted|inferred|schema-derived)\b.{0,100}\b(?:type|union|record)\.?$/isu,
  /^\s*an error indicating\b/iu,
  /^\s*runtime schema for decoding and validating\b/iu,
  /^\s*options accepted by\b/iu,
  /^\s*an (?:infallible\s+)?effect containing\b/iu,
  /^\s*(?:schema-decoded boundary for|decoded shape accepted by|stable discriminator used by)\b/iu
]

export const proseDiagnostic = (owner: string, text: string): string | undefined =>
  Arr.some(PROHIBITED, (pattern) => pattern.test(text)) ? `${owner}: prohibited prose: ${text}` : undefined

const normalized = (text: string): string => text.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, " ").trim()
const similarity = (left: string, right: string): number => {
  const leftText = normalized(left)
  const rightText = normalized(right)
  if (leftText === rightText) return 1
  const a = HashSet.fromIterable(leftText.split(" "))
  const b = HashSet.fromIterable(rightText.split(" "))
  const intersection = HashSet.size(HashSet.intersection(a, b))
  return Math.min(HashSet.size(a), HashSet.size(b)) < 8 ? 0 :
    intersection / Math.max(HashSet.size(a), HashSet.size(b), 1)
}

type Summary = { readonly owner: string; readonly summary: string }
type SourceSummary = Summary & { readonly sources: ReadonlyArray<string> }

const component = (
  frontier: ReadonlyArray<Summary>,
  pending: ReadonlyArray<Summary>,
  members: ReadonlyArray<Summary>
): { readonly members: ReadonlyArray<Summary>; readonly pending: ReadonlyArray<Summary> } => {
  const head = Arr.head(frontier)
  if (head._tag === "None") return { members, pending }
  const [remaining, peers] = Arr.partition(pending, (candidate) =>
    candidate.owner !== head.value.owner && similarity(head.value.summary, candidate.summary) >= 0.92)
  return component(
    [...Arr.drop(frontier, 1), ...peers],
    remaining,
    [...members, ...peers]
  )
}

const duplicateComponents = (
  pending: ReadonlyArray<Summary>
): ReadonlyArray<ReadonlyArray<Summary>> => {
  const head = Arr.head(pending)
  if (head._tag === "None") return []
  const found = component([head.value], Arr.drop(pending, 1), [head.value])
  return [found.members, ...duplicateComponents(found.pending)]
}

export const duplicateGroups = (
  entries: ReadonlyArray<Summary>
): ReadonlyArray<{ readonly owners: ReadonlyArray<string>; readonly summary: string }> => {
  const unique = Arr.dedupeWith(entries, (left, right) =>
    left.owner === right.owner && normalized(left.summary) === normalized(right.summary))
  return Arr.flatMap(duplicateComponents(Arr.sort(unique,
    Order.mapInput(Str.Order, (entry: Summary) => entry.owner))), (members) => members.length < 2 ? [] : [{
    owners: Arr.sort(Arr.map(members, (_) => _.owner), Str.Order),
    summary: normalized(members[0]?.summary ?? "")
  }])
}

export const unprojectedDuplicateGroups = (
  entries: ReadonlyArray<SourceSummary>
): ReadonlyArray<{ readonly owners: ReadonlyArray<string>; readonly summary: string }> => {
  const sourcesByOwner = HashMap.fromIterable(Arr.map(entries, (entry) => [entry.owner,
    Arr.dedupe(Arr.sort(Arr.filter(entry.sources, Str.isNonEmpty), Str.Order)).join("\u0000")] as const))
  return Arr.filter(duplicateGroups(entries), (group) => {
    const sources = Arr.filterMap(group.owners, (owner) => HashMap.get(sourcesByOwner, owner))
    return sources.length !== group.owners.length || Arr.some(sources, Str.isEmpty) ||
      HashSet.size(HashSet.fromIterable(sources)) !== 1
  })
}

export const exportDiagnostics = (owner: string, value: ApiExport): ReadonlyArray<string> => [
  ...(value.name.trim().length === 0 || value.category.trim().length === 0 || value.since.trim().length === 0 ||
    value.summary.trim().length === 0 ? [`${owner}: incomplete export metadata`] : []),
  ...Arr.fromNullable(categoryDiagnostic(owner, value.category)),
  ...Arr.fromNullable(proseDiagnostic(owner, value.summary)),
  ...(value.summary.includes("\n\n") ? [`${owner}: summary contains content that belongs in @remarks`] : []),
  ...(value.facets.length === 0 || Arr.every(value.facets, (facet) => facet.sourceUrl.trim().length === 0)
    ? [`${owner}: export has no facet/source link`] : [])
]
