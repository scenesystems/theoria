import { ActionButton, ActionLink } from "../primitives/ActionControl.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

export const DocsStatus = (
  props:
    | { readonly state: "loading" | "not-found" }
    | { readonly retry: () => void; readonly state: "failure" }
) => (
  <Stack className="items-start gap-3 py-16">
    <SemanticText
      as={props.state === "loading" ? "p" : "h1"}
      className={props.state === "loading" ? "text-ink-500" : "text-ink-950"}
      role={props.state === "loading" ? "status" : "section-title"}
      text={props.state === "failure"
        ? "Documentation unavailable"
        : props.state === "loading"
        ? "Loading…"
        : "Not found"}
    />
    {props.state === "failure"
      ? (
        <ActionButton
          className={docsTheme.secondaryAction}
          disabled={false}
          label="Try again"
          onClick={props.retry}
          variant="expanded"
        />
      )
      : null}
    {props.state === "not-found"
      ? (
        <ActionLink
          className={docsTheme.secondaryAction}
          href="/docs"
          label="View packages"
          variant="expanded"
        />
      )
      : null}
  </Stack>
)
