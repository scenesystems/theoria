import type { ApiDocumentation, ApiExport, DocsSearchEntry } from "@theoria/docs-model"
import { Array as Arr, HashMap, Option } from "effect"
import type { HashSet } from "effect"

import type { Counts, Example } from "./review-model.js"
import { linkDiagnostics, proseDiagnostic } from "./review-rules.js"

export type DocumentationRecord = {
  readonly owner: string
  readonly docs: ApiDocumentation
}

export const zeroCounts = (): Counts => ({
  packages: 0,
  modules: 0,
  routes: 0,
  imports: 0,
  projections: 0,
  facets: 0,
  members: 0,
  signatures: 0,
  typeParameters: 0,
  parameters: 0,
  returns: 0,
  examples: 0,
  deprecations: 0,
  links: 0,
  categories: 0
})

export const addCounts = (a: Counts, b: Counts): Counts => ({
  packages: a.packages + b.packages,
  modules: a.modules + b.modules,
  routes: a.routes + b.routes,
  imports: a.imports + b.imports,
  projections: a.projections + b.projections,
  facets: a.facets + b.facets,
  members: a.members + b.members,
  signatures: a.signatures + b.signatures,
  typeParameters: a.typeParameters + b.typeParameters,
  parameters: a.parameters + b.parameters,
  returns: a.returns + b.returns,
  examples: a.examples + b.examples,
  deprecations: a.deprecations + b.deprecations,
  links: a.links + b.links,
  categories: a.categories + b.categories
})

const docsParts = (docs: ApiDocumentation) =>
  Arr.flatten([
    docs.summary,
    docs.remarks,
    ...(docs.deprecated === null ? [] : [docs.deprecated]),
    ...docs.see,
    ...Arr.map(docs.examples, (_) => _.parts)
  ])

const partsText = (parts: ApiDocumentation["summary"]): string => Arr.map(parts, (_) => _.text).join("")

export const docsCounts = (docs: ReadonlyArray<ApiDocumentation>): Counts => ({
  ...zeroCounts(),
  examples: Arr.reduce(docs, 0, (count, value) => count + value.examples.length),
  deprecations: Arr.filter(docs, (_) => _.deprecated !== null).length,
  links: Arr.filter(Arr.flatMap(docs, docsParts), (_) => _.kind === "link").length
})

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

export const exportCounts = (value: ApiExport): Counts => {
  const members = Arr.flatMap(value.facets, (_) => _.members)
  const signatures = [
    ...Arr.flatMap(value.facets, (_) => _.signatures),
    ...Arr.flatMap(members, (_) => _.signatures)
  ]
  return addCounts({
    ...zeroCounts(),
    imports: 1,
    facets: value.facets.length,
    members: members.length,
    signatures: signatures.length,
    typeParameters: Arr.reduce(value.facets, 0, (count, _) => count + _.typeParameters.length) +
      Arr.reduce(signatures, 0, (count, _) => count + _.typeParameters.length),
    parameters: Arr.reduce(signatures, 0, (count, _) => count + _.parameters.length),
    returns: signatures.length
  }, docsCounts(Arr.map(documentationRecords(value), (_) => _.docs)))
}

export const semanticExport = (value: ApiExport) => ({
  id: value.id,
  name: value.name,
  importKind: value.importKind,
  category: value.category,
  since: value.since,
  summary: value.summary,
  facets: Arr.map(value.facets, (facet) => ({
    kind: facet.kind,
    declaration: facet.declaration,
    type: facet.type,
    typeParameters: facet.typeParameters,
    extends: facet.extends,
    implements: facet.implements,
    docs: facet.docs,
    signatures: Arr.map(facet.signatures, ({ sourceUrl: _, ...signature }) => signature),
    members: Arr.map(facet.members, ({ sourceUrl: _, ...member }) => ({
      ...member,
      signatures: Arr.map(member.signatures, ({ sourceUrl: __, ...signature }) => signature)
    }))
  }))
})

export const semanticHash = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex")

export const exampleRecords = (
  packageName: string,
  records: ReadonlyArray<DocumentationRecord>
): ReadonlyArray<Example> =>
  Arr.flatMap(
    records,
    ({ owner, docs }) => Arr.map(docs.examples, (example) => ({ owner, package: packageName, ...example }))
  )

export const documentationDiagnostics = (
  records: ReadonlyArray<DocumentationRecord>,
  targets: HashSet.HashSet<string>
): ReadonlyArray<string> =>
  Arr.dedupe(Arr.flatMap(records, ({ owner, docs }) => {
    const parts = docsParts(docs)
    const deprecated = docs.deprecated === null ? "" : partsText(docs.deprecated)
    return [
      ...linkDiagnostics(owner, parts, targets),
      ...Arr.filterMap(Arr.map(parts, (_) => _.text), (text) => Option.fromNullable(proseDiagnostic(owner, text))),
      ...(partsText(docs.summary).includes("\n\n")
        ? [`${owner}: summary contains content that belongs in @remarks`] :
        []),
      ...(deprecated.length > 0 &&
          (!/\buse\b/iu.test(deprecated) || !/\b(?:since|in)\s+v?\d+\.\d+\.\d+\b/iu.test(deprecated))
        ? [`${owner}: deprecation must identify a replacement and version`] :
        [])
    ]
  }))

export type ExpectedSearchEntry = Pick<
  DocsSearchEntry,
  "id" | "package" | "packageSlug" | "name" | "qualifiedName" | "category" | "summary" | "path" | "anchor"
>

export const searchIndexDiagnostics = (
  expected: ReadonlyArray<ExpectedSearchEntry>,
  entries: ReadonlyArray<DocsSearchEntry>
): ReadonlyArray<string> => {
  const symbols = Arr.filter(entries, (_) => _.kind === "symbol")
  const symbolsById = HashMap.fromIterable(Arr.map(symbols, (_) => [_.id, _] as const))
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
