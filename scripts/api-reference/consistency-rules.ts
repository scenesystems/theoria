import {
  type ApiDocPart,
  type ApiDocumentation,
  type ApiExport,
  type DocsSearchEntry,
  DocsSearchEntrySchema
} from "@theoria/docs-model"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Equal,
  HashMap,
  HashSet,
  Match,
  Number as Num,
  Option,
  Schema,
  String as Str,
  Tuple
} from "effect"

export class DocumentationRecord extends Data.Class<{
  readonly owner: string
  readonly docs: ApiDocumentation
}> {}

const numberText = Schema.encodeSync(Schema.NumberFromString)

const docsParts = (docs: ApiDocumentation): ReadonlyArray<ApiDocPart> => {
  const sections: ReadonlyArray<ReadonlyArray<ApiDocPart>> = Arr.appendAll(
    Arr.make(
      docs.summary,
      docs.remarks,
      Option.match(docs.deprecated, { onNone: Arr.empty, onSome: (parts) => parts })
    ),
    Arr.appendAll(docs.see, Arr.map(docs.examples, (_) => _.parts))
  )
  return Arr.flatten(sections)
}

export const documentationRecords = (value: ApiExport): ReadonlyArray<DocumentationRecord> =>
  Arr.flatMap(value.facets, (facet, facetIndex) =>
    Arr.appendAll(
      Arr.make(
        new DocumentationRecord({
          owner: `${value.id} facet ${numberText(Num.increment(facetIndex))}`,
          docs: facet.docs
        })
      ),
      Arr.appendAll(
        Arr.map(facet.signatures, (signature, signatureIndex) =>
          new DocumentationRecord({
            owner: `${value.id} signature ${numberText(Num.increment(signatureIndex))}`,
            docs: signature.docs
          })),
        Arr.flatMap(facet.members, (member) =>
          Arr.prepend(
            Arr.map(member.signatures, (signature, signatureIndex) =>
              new DocumentationRecord({
                owner: `${value.id}.${member.name} signature ${numberText(Num.increment(signatureIndex))}`,
                docs: signature.docs
              })),
            new DocumentationRecord({ owner: `${value.id}.${member.name}`, docs: member.docs })
          ))
      )
    ))

export const linkDiagnostics = (
  owner: string,
  parts: ReadonlyArray<ApiDocPart>,
  targets: HashSet.HashSet<string>
): ReadonlyArray<string> =>
  Arr.flatMap(parts, (part) =>
    Match.value(part).pipe(
      Match.when({ kind: "link" }, (link): ReadonlyArray<string> =>
        Option.match(link.href, {
          onNone: () => Arr.make(`${owner}: authored link has no target`),
          onSome: (href) =>
            Bool.match(Option.isSome(Str.match(/^https?:\/\//u)(href)), {
              onTrue: Arr.empty,
              onFalse: () =>
                Bool.match(Str.startsWith("/docs/")(href), {
                  onFalse: () => Arr.make(`${owner}: unsupported link target ${href}`),
                  onTrue: () =>
                    Bool.match(HashSet.has(targets, href), {
                      onTrue: Arr.empty,
                      onFalse: () => Arr.make(`${owner}: unresolved link ${href}`)
                    })
                })
            })
        })),
      Match.orElse((): ReadonlyArray<string> => Arr.empty())
    ))

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
  const symbols = Arr.filter(entries, (_) => Str.Equivalence(_.kind, "symbol"))
  const symbolsById = HashMap.fromIterable(Arr.map(symbols, (_) => Tuple.make(_.id, _)))
  return Arr.appendAll(
    Bool.match(Num.Equivalence(Arr.length(symbols), Arr.length(expected)), {
      onTrue: Arr.empty,
      onFalse: () => Arr.make("search index symbol count mismatch")
    }),
    Arr.flatMap(expected, (entry) =>
      HashMap.get(symbolsById, entry.id).pipe(
        Option.filter((actual) =>
          Bool.every(Arr.make(
            Str.Equivalence(actual.package, entry.package),
            Str.Equivalence(actual.packageSlug, entry.packageSlug),
            Str.Equivalence(actual.name, entry.name),
            Str.Equivalence(actual.qualifiedName, entry.qualifiedName),
            Equal.equals(actual.category, entry.category),
            Str.Equivalence(actual.summary, entry.summary),
            Str.Equivalence(actual.path, entry.path),
            Equal.equals(actual.anchor, entry.anchor)
          ))
        ),
        Option.match({
          onNone: () => Arr.make(`${entry.id}: search index mismatch`),
          onSome: Arr.empty
        })
      ))
  )
}
