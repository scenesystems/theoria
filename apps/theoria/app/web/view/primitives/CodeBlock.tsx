import { Button } from "@base-ui-components/react/button"
import { ScrollArea } from "@base-ui-components/react/scroll-area"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { CheckIcon, ClipboardDocumentIcon, ExclamationCircleIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"
import { Option } from "effect"

import { copyDocsCodeAtom, docsCopiedCodeAtom, docsCopyFailedCodeAtom } from "../../atoms/docs.js"
import type { CodeAnnotation } from "./code/CodeLine.js"
import type { CodeLink } from "./code/codeLinks.js"
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
  annotations = [],
  label,
  language = "typescript",
  links = [],
  source
}: {
  readonly annotations?: ReadonlyArray<CodeAnnotation>
  readonly label: string
  readonly language?: CodeLanguage
  readonly links?: ReadonlyArray<CodeLink>
  readonly source: string
}) => {
  const copy = useAtomSet(copyDocsCodeAtom)
  const copied = Option.contains(useAtomValue(docsCopiedCodeAtom), source)
  const failed = Option.contains(useAtomValue(docsCopyFailedCodeAtom), source)
  const copyLabel = copied ? "Copied" : failed ? "Copy failed" : "Copy"

  return (
    <Section aria-label={`${label} code example`} className={docsTheme.code}>
      <Cluster className="justify-between gap-3 border-b border-stage-200/78 bg-stage-50/60 px-4 py-2.5 sm:px-5">
        <Layer className="min-w-0 flex-1 basis-48">
          <SemanticText
            as="p"
            className="text-ink-600"
            role="code-meta"
            text={label}
            variant="expanded"
            wrapAuthority="native-browser"
          />
        </Layer>
        <Cluster className="shrink-0 gap-2">
          <SemanticText
            as="span"
            className="text-ink-500"
            role="row-label"
            text={languageLabel(language)}
            variant="expanded"
          />
          <Button
            aria-label={`${copyLabel} ${label}`}
            className={docsTheme.codeAction}
            onClick={() => copy(source)}
            type="button"
          >
            {copied
              ? <CheckIcon aria-hidden className="h-4 w-4" />
              : failed
              ? <ExclamationCircleIcon aria-hidden className="h-4 w-4" />
              : <ClipboardDocumentIcon aria-hidden className="h-4 w-4" />}
            <SemanticText as="span" className="text-inherit" role="button-label" text={copyLabel} />
          </Button>
        </Cluster>
      </Cluster>
      <ScrollArea.Root className="overflow-hidden">
        <ScrollArea.Viewport className="max-h-[32rem] w-full">
          <ScrollArea.Content>
            <Layer as="pre" className="m-0 min-w-max px-4 py-5 sm:px-5">
              <HighlightedCode
                annotations={annotations}
                language={language}
                links={links}
                source={source}
                variant="expanded"
              />
            </Layer>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          className="flex h-2.5 touch-none select-none bg-stage-100/70 p-0.5"
          orientation="horizontal"
        >
          <ScrollArea.Thumb className="h-full min-w-8 rounded-full bg-ink-700/35" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </Section>
  )
}
