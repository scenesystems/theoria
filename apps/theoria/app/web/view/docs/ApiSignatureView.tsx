import { Boolean as Bool, Equal, Number as Num, Option } from "effect"
import * as Arr from "effect/Array"

import type { ApiDocPart, ApiParameter, ApiSignature, ApiTypeParameter } from "@theoria/docs-model"
import { InlineHighlightedCode } from "../primitives/code/HighlightedCode.js"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { linkTextClassName } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { ApiDocumentationView } from "./ApiDocumentationView.js"
import { DocsRichText } from "./DocsRichText.js"

const typeParameterValue = (parameter: ApiTypeParameter): string =>
  `${parameter.name}${
    Option.match(parameter.constraint, { onNone: () => "", onSome: (value) => ` extends ${value}` })
  }${Option.match(parameter.default, { onNone: () => "", onSome: (value) => ` = ${value}` })}`

/** A rest parameter is spread; an optional one is marked as such. */
const parameterValue = (parameter: ApiParameter): string =>
  `${Bool.match(parameter.rest, { onTrue: () => "...", onFalse: () => "" })}${parameter.name}${
    Bool.match(parameter.optional, { onTrue: () => "?", onFalse: () => "" })
  }: ${parameter.type}${Option.match(parameter.defaultValue, { onNone: () => "", onSome: (value) => ` = ${value}` })}`

/**
 * One row of a definition list: the term, and beside it the description when
 * there is one. A documented row lays term and description out in two columns
 * from the small breakpoint; an undocumented one is the term alone.
 */
const DefinitionRow = ({
  description,
  documentedClassName,
  termClassName,
  value
}: {
  readonly description: ReadonlyArray<ApiDocPart>
  readonly documentedClassName: string
  readonly termClassName: string
  readonly value: string
}) =>
  Arr.match(description, {
    onEmpty: () => (
      <Layer className="py-3">
        <Layer render={<dt />} className={termClassName}>
          <InlineHighlightedCode source={value} />
        </Layer>
      </Layer>
    ),
    onNonEmpty: (parts) => (
      <Layer className={documentedClassName}>
        <Layer render={<dt />} className={termClassName}>
          <InlineHighlightedCode source={value} />
        </Layer>
        <SemanticContent as="dd" className="text-ink-tertiary" role="row-value">
          <DocsRichText parts={parts} />
        </SemanticContent>
      </Layer>
    )
  })

const definitionListClassName =
  "divide-y divide-hairline-glass rounded-instrument border border-hairline-veil bg-canvas-mist px-4"

export const ApiTypeParametersView = ({
  headingAs = "h3",
  parameters
}: {
  readonly headingAs?: "h3" | "h5"
  readonly parameters: ReadonlyArray<ApiTypeParameter>
}) =>
  Arr.match(parameters, {
    onEmpty: () => null,
    onNonEmpty: (present) => (
      <Stack className="gap-2">
        <SemanticContent as={headingAs} className="text-ink-tertiary" role="row-label">Type parameters</SemanticContent>
        <Stack render={<dl />} className={definitionListClassName}>
          {Arr.map(present, (parameter) => (
            <DefinitionRow
              description={parameter.description}
              documentedClassName="grid gap-1 py-3 sm:grid-cols-[minmax(10rem,0.45fr)_minmax(0,1fr)] sm:gap-5"
              key={parameter.name}
              termClassName="text-ink"
              value={typeParameterValue(parameter)}
            />
          ))}
        </Stack>
      </Stack>
    )
  })

const Parameters = ({
  headingAs,
  parameters
}: {
  readonly headingAs: "h3" | "h5"
  readonly parameters: ReadonlyArray<ApiParameter>
}) =>
  Arr.match(parameters, {
    onEmpty: () => null,
    onNonEmpty: (present) => (
      <Stack className="gap-2">
        <SemanticContent as={headingAs} className="text-ink-tertiary" role="row-label">Parameters</SemanticContent>
        <Stack render={<dl />} className={definitionListClassName}>
          {Arr.map(present, (parameter) => (
            <DefinitionRow
              description={parameter.description}
              documentedClassName="grid gap-1 py-3 sm:grid-cols-[minmax(12rem,0.48fr)_minmax(0,1fr)] sm:gap-5"
              key={parameter.name}
              termClassName="break-words text-ink"
              value={parameterValue(parameter)}
            />
          ))}
        </Stack>
      </Stack>
    )
  })

/** A lone signature is "Signature"; among overloads, each is numbered from one. */
const signatureLabel = (total: number, index: number): string =>
  Bool.match(Equal.equals(total, 1), {
    onTrue: () => "Signature",
    onFalse: () => `Overload ${String(Num.increment(index))}`
  })

export const ApiSignatureView = ({
  headingAs = "h3",
  index,
  signature,
  total
}: {
  readonly headingAs?: "h3" | "h5"
  readonly index: number
  readonly signature: ApiSignature
  readonly total: number
}) => (
  <Stack className="gap-5">
    <ApiDocumentationView docs={signature.docs} />
    <CodeBlock label={signatureLabel(total, index)} source={signature.code} />
    <ApiTypeParametersView headingAs={headingAs} parameters={signature.typeParameters} />
    <Parameters headingAs={headingAs} parameters={signature.parameters} />
    <Stack className="gap-2">
      <SemanticContent as={headingAs} className="text-ink-tertiary" role="row-label">Returns</SemanticContent>
      <Cluster
        align="start"
        className="gap-x-4 gap-y-2 rounded-instrument border border-hairline-veil bg-canvas-mist px-4 py-3"
      >
        <InlineHighlightedCode className="min-w-0 max-w-full text-ink" source={signature.returns.type} />
        {Arr.match(signature.returns.description, {
          onEmpty: () => null,
          onNonEmpty: (parts) => (
            <SemanticContent as="span" className="text-ink-tertiary" role="row-value">
              <DocsRichText parts={parts} />
            </SemanticContent>
          )
        })}
      </Cluster>
    </Stack>
    <ExternalLink
      className={`w-fit font-body text-sm font-medium text-ink-tertiary ${linkTextClassName}`}
      href={signature.sourceUrl}
    >
      Source
    </ExternalLink>
  </Stack>
)
