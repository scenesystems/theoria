import { ScrollArea } from "@base-ui-components/react/scroll-area"

import { HighlightedCode } from "./code/HighlightedCode.js"
import { docsTheme } from "./docsSystem.js"
import { Cluster, Layer, Section } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

export const CodeBlock = ({
  label,
  language = "TypeScript",
  source
}: {
  readonly label: string
  readonly language?: "Shell" | "TypeScript"
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
        text={language}
        variant="expanded"
      />
    </Cluster>
    <ScrollArea.Root className="overflow-hidden">
      <ScrollArea.Viewport className="max-h-[32rem] w-full">
        <ScrollArea.Content>
          <Layer as="pre" className="m-0 min-w-max px-4 py-5 sm:px-5">
            {language === "TypeScript"
              ? <HighlightedCode source={source} variant="expanded" />
              : (
                <SemanticText
                  as="code"
                  className="block text-ink-900"
                  role="code-block"
                  text={source}
                  variant="expanded"
                />
              )}
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
