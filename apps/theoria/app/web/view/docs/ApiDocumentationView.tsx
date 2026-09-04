import { Option } from "effect"
import * as Arr from "effect/Array"

import type { ApiDocumentation } from "@theoria/docs-model"
import { CodeBlock, codeLanguageFor } from "../primitives/CodeBlock.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsRichText } from "./DocsRichText.js"

const RichParagraph = ({ parts }: { readonly parts: ApiDocumentation["summary"] }) =>
  parts.length === 0
    ? null
    : (
      <SemanticContent as="p" className="text-ink-700" role="row-value">
        <DocsRichText parts={parts} />
      </SemanticContent>
    )

export const ApiDocumentationView = ({ docs }: { readonly docs: ApiDocumentation }) => (
  <Stack className="gap-5">
    <RichParagraph parts={docs.summary} />
    {Option.match(docs.deprecated, {
      onNone: () => null,
      onSome: (deprecated) => (
        <Layer className="rounded-xl border border-tone-search-300/70 bg-tone-search-100/45 px-4 py-3">
          <Stack className="gap-1.5">
            <SemanticText as="p" className="text-tone-search-900" role="row-label" text="Deprecated" />
            <SemanticContent as="p" className="text-tone-search-900" role="row-value">
              <DocsRichText parts={deprecated} />
            </SemanticContent>
          </Stack>
        </Layer>
      )
    })}
    {docs.remarks.length === 0
      ? null
      : (
        <Stack className="gap-2">
          <SemanticContent as="h4" className="text-ink-900" role="selection-title">Remarks</SemanticContent>
          <RichParagraph parts={docs.remarks} />
        </Stack>
      )}
    {Arr.map(docs.examples, (example, index) => (
      <Layer key={`example:${String(index)}`}>
        {Option.match(example.code, {
          onNone: () => <RichParagraph parts={example.parts} />,
          onSome: (code) => (
            <CodeBlock
              label={docs.examples.length === 1 ? "Example" : `Example ${String(index + 1)}`}
              language={codeLanguageFor(Option.getOrElse(example.language, () => "text"))}
              source={code}
            />
          )
        })}
      </Layer>
    ))}
    {docs.see.length === 0
      ? null
      : (
        <Stack className="gap-2">
          <SemanticContent as="h4" className="text-ink-900" role="selection-title">See also</SemanticContent>
          <Stack as="ul" className="ml-5 list-disc gap-1.5 text-ink-700">
            {Arr.map(docs.see, (parts, index) => (
              <li className="pl-1" key={`see:${String(index)}`}>
                <SemanticContent as="span" role="row-value">
                  <DocsRichText parts={parts} />
                </SemanticContent>
              </li>
            ))}
          </Stack>
        </Stack>
      )}
  </Stack>
)
