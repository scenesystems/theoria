import { Option, Schema } from "effect"
import {
  type GraphVariant,
  GraphVariantSchema,
  type WorkflowNodeKind,
  WorkflowNodeKindSchema
} from "effect-inference/Contracts"

import type { EvidenceItem, EvidenceSection } from "../../../contracts/evidence.js"
import { workflowComparisonNodeExecutionSectionPrefix } from "../../../contracts/workflow/comparison-evidence-keys.js"

const isGraphVariant = Schema.is(GraphVariantSchema)
const isWorkflowNodeKind = Schema.is(WorkflowNodeKindSchema)
const workflowComparisonNodeExecutionSectionKind = workflowComparisonNodeExecutionSectionPrefix.split("/")[1]
  ?? "node-execution"

export type WorkflowComparisonNodeExecutionSectionDescriptor = {
  readonly key: string
  readonly nodeId: string
  readonly nodeKind: WorkflowNodeKind
  readonly variant: GraphVariant
}

export const sectionByKey = (
  sections: ReadonlyArray<EvidenceSection>,
  key: string
): EvidenceSection | null => sections.find((section) => section.key === key) ?? null

const textItemByKey = (
  section: EvidenceSection | null,
  key: string
): Extract<EvidenceItem, { readonly _tag: "Text" }> | null =>
  section?.items.find(
    (item): item is Extract<EvidenceItem, { readonly _tag: "Text" }> => item._tag === "Text" && item.key === key
  ) ?? null

const scalarItemByKey = (
  section: EvidenceSection | null,
  key: string
): Extract<EvidenceItem, { readonly _tag: "Scalar" }> | null =>
  section?.items.find(
    (item): item is Extract<EvidenceItem, { readonly _tag: "Scalar" }> => item._tag === "Scalar" && item.key === key
  ) ?? null

export const comparisonItemByKey = (
  section: EvidenceSection | null,
  key: string
): Extract<EvidenceItem, { readonly _tag: "Comparison" }> | null =>
  section?.items.find(
    (item): item is Extract<EvidenceItem, { readonly _tag: "Comparison" }> =>
      item._tag === "Comparison" && item.key === key
  ) ?? null

export const tableItemByKey = (
  section: EvidenceSection | null,
  key: string
): Extract<EvidenceItem, { readonly _tag: "Table" }> | null =>
  section?.items.find(
    (item): item is Extract<EvidenceItem, { readonly _tag: "Table" }> => item._tag === "Table" && item.key === key
  ) ?? null

export const textValueByKey = (section: EvidenceSection | null, key: string): string | null =>
  textItemByKey(section, key)?.value ?? null

export const scalarValueByKey = (section: EvidenceSection | null, key: string): number | null =>
  scalarItemByKey(section, key)?.value ?? null

export const stringPairFromRow = (row: ReadonlyArray<string>): ReadonlyArray<[string, string]> =>
  Option.all({
    choice: Option.fromNullable(row[1]),
    knob: Option.fromNullable(row[0])
  }).pipe(
    Option.match({
      onNone: () => [],
      onSome: ({ choice, knob }) => [[knob, choice]]
    })
  )

export const stringTripleFromRow = (row: ReadonlyArray<string>): ReadonlyArray<[string, string, string]> =>
  Option.all({
    detail: Option.fromNullable(row[2]),
    event: Option.fromNullable(row[1]),
    index: Option.fromNullable(row[0])
  }).pipe(
    Option.match({
      onNone: () => [],
      onSome: ({ detail, event, index }) => [[index, event, detail]]
    })
  )

export const leadingTextFromRow = (row: ReadonlyArray<string>): ReadonlyArray<string> =>
  Option.fromNullable(row[0]).pipe(
    Option.match({
      onNone: () => [],
      onSome: (value) => [value]
    })
  )

export const parseNodeExecutionSectionKey = (
  key: Option.Option<string>
): WorkflowComparisonNodeExecutionSectionDescriptor | null =>
  key.pipe(
    Option.flatMap((value) => {
      const [scope, kind, variant, nodeId, nodeKind] = value.split("/")
      const isNodeExecutionSection = scope === "workflow-comparison"
        && kind === workflowComparisonNodeExecutionSectionKind
        && isGraphVariant(variant)

      return isNodeExecutionSection
        ? Option.all({
          nodeId: Option.fromNullable(nodeId),
          nodeKind: Option.fromNullable(nodeKind)
        }).pipe(
          Option.flatMap(({ nodeId, nodeKind }) =>
            isWorkflowNodeKind(nodeKind)
              ? Option.some({ key: value, nodeId, nodeKind, variant })
              : Option.none()
          )
        )
        : Option.none()
    }),
    Option.match({
      onNone: () => null,
      onSome: (descriptor) => descriptor
    })
  )
