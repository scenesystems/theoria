import { ActionButton } from "../primitives/ActionControl.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

type DocsStatusState = "failure" | "loading" | "not-found"

export const DocsStatus = ({ retry, state }: {
  readonly retry: () => void
  readonly state: DocsStatusState
}) => (
  <Stack className="items-start gap-3 py-16">
    <SemanticText
      as={state === "loading" ? "p" : "h1"}
      className={state === "loading" ? "text-ink-500" : "text-ink-950"}
      role={state === "loading" ? "status" : "section-title"}
      text={state === "failure" ? "Documentation unavailable" : state === "loading" ? "Loading…" : "Not found"}
    />
    {state === "failure"
      ? (
        <ActionButton
          className={docsTheme.secondaryAction}
          disabled={false}
          label="Try again"
          onClick={retry}
          variant="expanded"
        />
      )
      : null}
  </Stack>
)
