import { Boolean as Bool, Equal, Number as Num, Option } from "effect"
import * as Arr from "effect/Array"

import type { ApiDocumentation } from "@theoria/docs-model"
import { CodeBlock, codeLanguageFor } from "../primitives/CodeBlock.js"
import { noticeClassName } from "../primitives/designSystem.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsRichText } from "./DocsRichText.js"

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
          <SemanticContent as={headingAs} role={headingAs === "h2" ? "section-title" : "selection-title"}>
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
          <SemanticContent as={headingAs} role={headingAs === "h2" ? "section-title" : "selection-title"}>
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
