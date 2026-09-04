import {
  type ApiDocPart,
  type ApiDocumentation,
  type ApiExport,
  type DocsSearchEntry,
  DocsSearchEntrySchema
} from "@theoria/docs-model"
import { Array as Arr, HashMap, HashSet, Option, Tuple } from "effect"

export type DocumentationRecord = {
  readonly owner: string
  readonly docs: ApiDocumentation
}

const docsParts = (docs: ApiDocumentation): ReadonlyArray<ApiDocPart> =>
  Arr.flatten([
    docs.summary,
    docs.remarks,
    ...(docs.deprecated === null ? [] : [docs.deprecated]),
    ...docs.see,
    ...Arr.map(docs.examples, (_) => _.parts)
  ])

export const documentationRecords = (value: ApiExport): ReadonlyArray<DocumentationRecord> =>
  Arr.flatMap(value.facets, (facet, facetIndex) => [
    { owner: `${value.id} facet ${String(facetIndex + 1)}`, docs: facet.docs },
    ...Arr.map(facet.signatures, (signature, signatureIndex) => ({
      owner: `${value.id} signature ${String(signatureIndex + 1)}`,
      docs: signature.docs
    })),
    ...Arr.flatMap(facet.members, (member) => [
      { owner: `${value.id}.${member.name}`, docs: member.docs },
      ...Arr.map(member.signatures, (signature, signatureIndex) => ({
        owner: `${value.id}.${member.name} signature ${String(signatureIndex + 1)}`,
        docs: signature.docs
      }))
    ])
  ])

export const linkDiagnostics = (
  owner: string,
  parts: ReadonlyArray<ApiDocPart>,
  targets: HashSet.HashSet<string>
): ReadonlyArray<string> =>
  Arr.flatMap(parts, (part) => {
    if (part.kind !== "link") return []
    if (part.href === null) return [`${owner}: authored link has no target`]
    if (/^https?:\/\//u.test(part.href)) return []
    if (!part.href.startsWith("/docs/")) return [`${owner}: unsupported link target ${part.href}`]
    return HashSet.has(targets, part.href) ? [] : [`${owner}: unresolved link ${part.href}`]
  })

export const documentationLinkDiagnostics = (
  records: ReadonlyArray<DocumentationRecord>,
  targets: HashSet.HashSet<string>
): ReadonlyArray<string> =>
  Arr.dedupe(Arr.flatMap(records, ({ owner, docs }) => linkDiagnostics(owner, docsParts(docs), targets)))

const ExpectedSearchEntrySchema = DocsSearchEntrySchema.omit("kind")

export type ExpectedSearchEntry = typeof ExpectedSearchEntrySchema.Type

export const searchIndexDiagnostics = (
  expected: ReadonlyArray<ExpectedSearchEntry>,
  entries: ReadonlyArray<DocsSearchEntry>
): ReadonlyArray<string> => {
  const symbols = Arr.filter(entries, (_) => _.kind === "symbol")
  const symbolsById = HashMap.fromIterable(Arr.map(symbols, (_) => Tuple.make(_.id, _)))
  return [
    ...(symbols.length !== expected.length ? ["search index symbol count mismatch"] : []),
    ...Arr.flatMap(expected, (entry) =>
      HashMap.get(symbolsById, entry.id).pipe(
        Option.filter((actual) =>
          actual.package === entry.package && actual.packageSlug === entry.packageSlug &&
          actual.name === entry.name && actual.qualifiedName === entry.qualifiedName &&
          actual.category === entry.category && actual.summary === entry.summary &&
          actual.path === entry.path && actual.anchor === entry.anchor
        ),
        Option.match({
          onNone: () => [`${entry.id}: search index mismatch`],
          onSome: () => []
        })
      ))
  ]
}
