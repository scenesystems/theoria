import { ScrollArea } from "@base-ui-components/react/scroll-area"
import { Match } from "effect"

import { HighlightedCode } from "./code/HighlightedCode.js"
import type { CodeLanguage } from "./code/highlighter.js"
import { docsTheme } from "./docsSystem.js"
import { Cluster, Layer, Section } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

export const codeLanguageFor = (language: string): CodeLanguage =>
  Match.value(language.trim().toLocaleLowerCase("en-US")).pipe(
    Match.when("ts", (): CodeLanguage => "typescript"),
    Match.when("typescript", (): CodeLanguage => "typescript"),
    Match.when("sh", (): CodeLanguage => "shellscript"),
    Match.when("shell", (): CodeLanguage => "shellscript"),
    Match.when("shellscript", (): CodeLanguage => "shellscript"),
    Match.when("bash", (): CodeLanguage => "shellscript"),
    Match.orElse((): CodeLanguage => "text")
  )

const languageLabel = (language: CodeLanguage): string =>
  Match.value(language).pipe(
    Match.when("typescript", () => "TypeScript"),
    Match.when("shellscript", () => "Shell"),
    Match.when("text", () => "Text"),
    Match.exhaustive
  )

export const CodeBlock = ({
  label,
  language = "typescript",
  source
}: {
  readonly label: string
  readonly language?: CodeLanguage
  readonly source: string
}) => (
  <Section aria-label={`${label} code example`} className={docsTheme.code}>
    <Cluster className="justify-between gap-3 border-b border-stage-200/78 bg-stage-50/60 px-4 py-2.5 sm:px-5">
      <SemanticText
        as="code"
        className="text-ink-600"
        role="code-meta"
        text={label}
        variant="expanded"
      />
      <SemanticText
        as="span"
        className="text-ink-500"
        role="row-label"
        text={languageLabel(language)}
        variant="expanded"
      />
    </Cluster>
    <ScrollArea.Root className="overflow-hidden">
      <ScrollArea.Viewport className="max-h-[32rem] w-full">
        <ScrollArea.Content>
          <Layer as="pre" className="m-0 min-w-max px-4 py-5 sm:px-5">
            <HighlightedCode language={language} source={source} variant="expanded" />
          </Layer>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        className="flex h-2.5 touch-none select-none bg-stage-100/70 p-0.5"
        orientation="horizontal"
      >
        <ScrollArea.Thumb className="flex-1 rounded-full bg-ink-700/30" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  </Section>
)
