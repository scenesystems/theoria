import * as Arr from "effect/Array"

import type { ApiExport, ApiFacet } from "@theoria/docs-model"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ApiDocumentationView } from "./ApiDocumentationView.js"
import { ApiMemberView } from "./ApiMemberView.js"
import { ApiSignatureView, ApiTypeParametersView } from "./ApiSignatureView.js"

const RelationList = ({ facet }: { readonly facet: ApiFacet }) => {
  const relations = [
    ...Arr.map(facet.extends, (value) => `extends ${value}`),
    ...Arr.map(facet.implements, (value) => `implements ${value}`)
  ]

  return relations.length === 0
    ? null
    : (
      <Cluster className="gap-2">
        {Arr.map(relations, (relation) => (
          <SemanticText
            as="code"
            className="rounded-lg border border-stage-200/90 bg-stage-100/60 px-2.5 py-1 text-ink-600"
            key={relation}
            role="code-meta"
            text={relation}
          />
        ))}
      </Cluster>
    )
}

const ApiFacetView = ({ facet }: { readonly facet: ApiFacet }) => (
  <Stack className="gap-6">
    {facet.signatures.length === 0
      ? (
        <Stack className="gap-5">
          <ApiDocumentationView docs={facet.docs} />
          <CodeBlock label="Type" source={facet.declaration} />
          <ApiTypeParametersView parameters={facet.typeParameters} />
          <RelationList facet={facet} />
          <ExternalLink
            className="w-fit font-body text-sm font-medium text-ink-600 underline decoration-stage-400 underline-offset-4 hover:text-ink-950"
            href={facet.sourceUrl}
          >
            Source
          </ExternalLink>
        </Stack>
      )
      : (
        <Stack className="gap-9">
          {Arr.map(
            facet.signatures,
            (signature, index) => (
              <ApiSignatureView
                index={index}
                key={`${signature.kind}:${String(index)}`}
                signature={signature}
                total={facet.signatures.length}
              />
            )
          )}
        </Stack>
      )}
    {facet.members.length === 0
      ? null
      : (
        <Stack className="gap-7 pt-2">
          <SemanticContent as="h3" className="text-ink-900" role="section-title">Members</SemanticContent>
          {Arr.map(facet.members, (member) => <ApiMemberView key={member.anchor} member={member} />)}
        </Stack>
      )}
  </Stack>
)

export const ApiExportView = ({ apiExport }: { readonly apiExport: ApiExport }) => (
  <Section className="scroll-mt-28 border-t border-stage-200/90 pt-9 first:border-t-0 first:pt-0" id={apiExport.anchor}>
    <Stack className="gap-7">
      <Stack className="gap-3">
        <SemanticText as="h1" className="break-words text-ink-950" role="section-title" text={apiExport.name} />
        <Cluster className="gap-2">
          <SemanticText
            as="span"
            className="rounded-md bg-stage-100 px-2 py-1 text-ink-600"
            role="row-label"
            text={apiExport.category}
          />
          <SemanticText as="span" className="text-ink-500" role="code-meta" text={`since ${apiExport.since}`} />
        </Cluster>
      </Stack>
      <Stack className="gap-9">
        {Arr.map(
          apiExport.facets,
          (facet, index) => (
            <Layer
              className={index === 0 ? "" : "border-t border-stage-200/75 pt-8"}
              key={`${facet.kind}:${String(index)}`}
            >
              <ApiFacetView facet={facet} />
            </Layer>
          )
        )}
      </Stack>
    </Stack>
  </Section>
)
