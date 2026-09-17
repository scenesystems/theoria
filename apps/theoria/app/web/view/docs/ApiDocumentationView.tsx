import { Boolean as Bool, Equal, Match, Number as Num, Option } from "effect"
import * as Arr from "effect/Array"
import * as Schema from "effect/Schema"

import { type ApiDocumentation, ApiDocumentationSchema } from "@theoria/docs-model"
import { CodeBlock, codeLanguageFor } from "../primitives/CodeBlock.js"
import { noticeClassName } from "../primitives/designSystem.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsRichText } from "./DocsRichText.js"

/** TypeDoc can attach the same declaration comment to both a callable and its signature. */
export const apiDocumentationEquals = Schema.equivalence(ApiDocumentationSchema)

const emptyApiDocumentation: ApiDocumentation = {
  summary: [],
  remarks: [],
  examples: [],
  deprecated: Option.none(),
  see: []
}

export const apiDocumentationIsEmpty = (docs: ApiDocumentation): boolean =>
  apiDocumentationEquals(docs, emptyApiDocumentation)

const headingRole = (headingAs: "h2" | "h4"): "section-title" | "selection-title" =>
  Match.value(headingAs).pipe(
    Match.withReturnType<"section-title" | "selection-title">(),
    Match.when("h2", () => "section-title"),
    Match.when("h4", () => "selection-title"),
    Match.exhaustive
  )

const RichParagraph = ({ parts }: { readonly parts: ApiDocumentation["summary"] }) =>
  Arr.match(parts, {
    onEmpty: () => null,
    onNonEmpty: (present) => (
      <SemanticContent as="p" role="body">
        <DocsRichText parts={present} />
      </SemanticContent>
    )
  })

/** One example reads "Example"; among several, each is numbered from one. */
const exampleLabel = (total: number, index: number): string =>
  Bool.match(Equal.equals(total, 1), {
    onTrue: () => "Example",
    onFalse: () => `Example ${String(Num.increment(index))}`
  })

export const ApiDocumentationView = ({ docs, headingAs = "h2" }: {
  readonly docs: ApiDocumentation
  readonly headingAs?: "h2" | "h4"
}) => (
  <Stack className="gap-5">
    <RichParagraph parts={docs.summary} />
    {Option.match(docs.deprecated, {
      onNone: () => null,
      onSome: (deprecated) => (
        <Layer className={noticeClassName}>
          <Stack className="gap-1.5">
            <SemanticText as="p" role="row-label" text="Deprecated" />
            <SemanticContent as="p" role="body">
              <DocsRichText parts={deprecated} />
            </SemanticContent>
          </Stack>
        </Layer>
      )
    })}
    {Arr.match(docs.remarks, {
      onEmpty: () => null,
      onNonEmpty: (remarks) => (
        <Stack className="gap-2">
          <SemanticContent as={headingAs} role={headingRole(headingAs)}>
            Remarks
          </SemanticContent>
          <RichParagraph parts={remarks} />
        </Stack>
      )
    })}
    {Arr.map(docs.examples, (example, index) => (
      <Layer key={`example:${String(index)}`}>
        {Option.match(example.code, {
          onNone: () => <RichParagraph parts={example.parts} />,
          onSome: (code) => (
            <CodeBlock
              label={exampleLabel(Arr.length(docs.examples), index)}
              language={codeLanguageFor(Option.getOrElse(example.language, () => "text"))}
              source={code}
            />
          )
        })}
      </Layer>
    ))}
    {Arr.match(docs.see, {
      onEmpty: () => null,
      onNonEmpty: (see) => (
        <Stack className="gap-2">
          <SemanticContent as={headingAs} role={headingRole(headingAs)}>
            See also
          </SemanticContent>
          <Stack render={<ul />} className="ml-5 list-disc gap-1.5">
            {Arr.map(see, (parts, index) => (
              <li className="pl-1" key={`see:${String(index)}`}>
                <SemanticContent as="span" role="body">
                  <DocsRichText parts={parts} />
                </SemanticContent>
              </li>
            ))}
          </Stack>
        </Stack>
      )
    })}
  </Stack>
)
