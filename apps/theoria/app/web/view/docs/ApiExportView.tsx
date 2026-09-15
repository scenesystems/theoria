import { Boolean as Bool, Equal } from "effect"
import * as Arr from "effect/Array"

import type { ApiExport, ApiFacet } from "@theoria/docs-model"
import { InlineHighlightedCode } from "../primitives/code/HighlightedCode.js"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { linkTextClassName } from "../primitives/designSystem.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ApiDocumentationView } from "./ApiDocumentationView.js"
import { ApiMemberView } from "./ApiMemberView.js"
import { ApiSignatureView, ApiTypeParametersView } from "./ApiSignatureView.js"

const RelationList = ({ facet }: { readonly facet: ApiFacet }) =>
  Arr.match(
    Arr.appendAll(
      Arr.map(facet.extends, (value) => `extends ${value}`),
      Arr.map(facet.implements, (value) => `implements ${value}`)
    ),
    {
      onEmpty: () => null,
      onNonEmpty: (relations) => (
        <Cluster className="gap-2">
          {Arr.map(relations, (relation) => (
            <Layer
              className="rounded-control border border-hairline-veil bg-instrument-glass px-2.5 py-1 text-ink-tertiary"
              key={relation}
            >
              <InlineHighlightedCode source={relation} />
            </Layer>
          ))}
        </Cluster>
      )
    }
  )

const ApiFacetView = ({ facet }: { readonly facet: ApiFacet }) => (
  <Stack className="gap-6">
    {Arr.match(facet.signatures, {
      onEmpty: () => (
        <Stack className="gap-5">
          <ApiDocumentationView docs={facet.docs} />
          <CodeBlock label="Type" source={facet.declaration} />
          <ApiTypeParametersView parameters={facet.typeParameters} />
          <RelationList facet={facet} />
          <ExternalLink
            className={`w-fit text-ink-secondary ${linkTextClassName}`}
            href={facet.sourceUrl}
          >
            <SemanticText as="span" role="button-label" text="Source" />
          </ExternalLink>
        </Stack>
      ),
      onNonEmpty: (signatures) => (
        <Stack className="gap-9">
          {Arr.map(
            signatures,
            (signature, index) => (
              <ApiSignatureView
                index={index}
                key={`${signature.kind}:${String(index)}`}
                signature={signature}
                total={Arr.length(signatures)}
              />
            )
          )}
        </Stack>
      )
    })}
    {Arr.match(facet.members, {
      onEmpty: () => null,
      onNonEmpty: (members) => (
        <Stack className="gap-7 pt-2">
          <SemanticContent as="h2" role="section-title">Members</SemanticContent>
          {Arr.map(members, (member) => <ApiMemberView key={member.anchor} member={member} />)}
        </Stack>
      )
    })}
  </Stack>
)

/** Every facet after the first is ruled off from the one above it. */
const facetClassName = (index: number): string =>
  Bool.match(Equal.equals(index, 0), {
    onTrue: () => "",
    onFalse: () => "border-t border-hairline-glass pt-8"
  })

export const ApiExportView = ({ apiExport }: { readonly apiExport: ApiExport }) => (
  <Section
    className="scroll-mt-28 border-t border-hairline-veil pt-9 first:border-t-0 first:pt-0"
    id={apiExport.anchor}
  >
    <Stack className="gap-7">
      <Stack className="gap-3">
        <SemanticText as="h1" className="break-words" role="hero-title" text={apiExport.name} />
        <Cluster className="gap-2">
          <SemanticText
            as="span"
            className="rounded-mark bg-instrument px-2 py-1"
            role="row-label"
            text={apiExport.category}
          />
          <SemanticText as="span" className="text-ink-tertiary" role="code-meta" text={`since ${apiExport.since}`} />
        </Cluster>
      </Stack>
      <Stack className="gap-9">
        {Arr.map(
          apiExport.facets,
          (facet, index) => (
            <Layer className={facetClassName(index)} key={`${facet.kind}:${String(index)}`}>
              <ApiFacetView facet={facet} />
            </Layer>
          )
        )}
      </Stack>
    </Stack>
  </Section>
)
