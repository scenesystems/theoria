import * as Arr from "effect/Array"

import type { ApiParameter, ApiSignature, ApiTypeParameter } from "@theoria/docs-model"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ApiDocumentationView } from "./ApiDocumentationView.js"
import { DocsRichText } from "./DocsRichText.js"

const typeParameterValue = (parameter: ApiTypeParameter): string =>
  `${parameter.name}${parameter.constraint === null ? "" : ` extends ${parameter.constraint}`}${
    parameter.default === null ? "" : ` = ${parameter.default}`
  }`

export const ApiTypeParametersView = ({
  headingAs = "h3",
  parameters
}: {
  readonly headingAs?: "h3" | "h5"
  readonly parameters: ReadonlyArray<ApiTypeParameter>
}) =>
  parameters.length === 0
    ? null
    : (
      <Stack className="gap-2">
        <SemanticContent as={headingAs} className="text-ink-500" role="row-label">Type parameters</SemanticContent>
        <Stack
          as="dl"
          className="divide-y divide-stage-200/75 rounded-xl border border-stage-200/90 bg-stage-50/45 px-4"
        >
          {Arr.map(
            parameters,
            (parameter) => {
              const documented = parameter.description.length > 0

              return (
                <Layer
                  className={documented
                    ? "grid gap-1 py-3 sm:grid-cols-[minmax(10rem,0.45fr)_minmax(0,1fr)] sm:gap-5"
                    : "py-3"}
                  key={parameter.name}
                >
                  <SemanticText
                    as="dt"
                    className="text-ink-900"
                    role="code-meta"
                    text={typeParameterValue(parameter)}
                  />
                  {documented
                    ? (
                      <SemanticContent as="dd" className="text-ink-600" role="row-value">
                        <DocsRichText parts={parameter.description} />
                      </SemanticContent>
                    )
                    : null}
                </Layer>
              )
            }
          )}
        </Stack>
      </Stack>
    )

const parameterValue = (parameter: ApiParameter): string =>
  `${parameter.rest ? "..." : ""}${parameter.name}${parameter.optional ? "?" : ""}: ${parameter.type}${
    parameter.defaultValue === null ? "" : ` = ${parameter.defaultValue}`
  }`

const Parameters = ({
  headingAs,
  parameters
}: {
  readonly headingAs: "h3" | "h5"
  readonly parameters: ReadonlyArray<ApiParameter>
}) =>
  parameters.length === 0
    ? null
    : (
      <Stack className="gap-2">
        <SemanticContent as={headingAs} className="text-ink-500" role="row-label">Parameters</SemanticContent>
        <Stack
          as="dl"
          className="divide-y divide-stage-200/75 rounded-xl border border-stage-200/90 bg-stage-50/45 px-4"
        >
          {Arr.map(
            parameters,
            (parameter) => {
              const documented = parameter.description.length > 0

              return (
                <Layer
                  className={documented
                    ? "grid gap-1 py-3 sm:grid-cols-[minmax(12rem,0.48fr)_minmax(0,1fr)] sm:gap-5"
                    : "py-3"}
                  key={parameter.name}
                >
                  <SemanticText
                    as="dt"
                    className="break-words text-ink-900"
                    role="code-meta"
                    text={parameterValue(parameter)}
                  />
                  {documented
                    ? (
                      <SemanticContent as="dd" className="text-ink-600" role="row-value">
                        <DocsRichText parts={parameter.description} />
                      </SemanticContent>
                    )
                    : null}
                </Layer>
              )
            }
          )}
        </Stack>
      </Stack>
    )

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
    <CodeBlock label={total === 1 ? "Signature" : `Overload ${String(index + 1)}`} source={signature.code} />
    <ApiTypeParametersView headingAs={headingAs} parameters={signature.typeParameters} />
    <Parameters headingAs={headingAs} parameters={signature.parameters} />
    <Stack className="gap-2">
      <SemanticContent as={headingAs} className="text-ink-500" role="row-label">Returns</SemanticContent>
      <Cluster className="items-start gap-x-4 gap-y-2 rounded-xl border border-stage-200/90 bg-stage-50/45 px-4 py-3">
        <SemanticContent as="code" className="min-w-0 max-w-full break-words text-ink-900" role="code-meta">
          {signature.returns.type}
        </SemanticContent>
        {signature.returns.description.length > 0
          ? (
            <SemanticContent as="span" className="text-ink-600" role="row-value">
              <DocsRichText parts={signature.returns.description} />
            </SemanticContent>
          )
          : null}
      </Cluster>
    </Stack>
    <ExternalLink
      className="w-fit font-body text-sm font-medium text-ink-600 underline decoration-stage-400 underline-offset-4 hover:text-ink-950"
      href={signature.sourceUrl}
    >
      Source
    </ExternalLink>
  </Stack>
)
