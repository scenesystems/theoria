import type { ElementType, ReactNode } from "react"

import { Box, type BoxProps, mergeClassNames } from "./Box.js"

export type SemanticRole =
  | "display-lg"
  | "display"
  | "display-sm"
  | "body-lg"
  | "body"
  | "body-sm"
  | "eyebrow"
  | "label"
  | "button"
  | "badge"
  | "tab"
  | "status"
  | "workspace-title"
  | "workspace-summary"
  | "pane-title"
  | "pane-summary"
  | "pane-meta"
  | "strip-label"
  | "transcript-actor"
  | "transcript-meta"
  | "detail-label"
  | "detail-value"
  | "payload-label"
  | "inspector-title"
  | "inspector-summary"

export type SemanticTone = "default" | "muted" | "subtle" | "accent" | "danger" | "inherit"

const roleElementMap: Record<SemanticRole, ElementType> = {
  "display-lg": "h1",
  display: "h2",
  "display-sm": "h3",
  "body-lg": "p",
  body: "p",
  "body-sm": "p",
  eyebrow: "p",
  label: "span",
  button: "span",
  badge: "span",
  tab: "span",
  status: "span",
  "workspace-title": "h1",
  "workspace-summary": "p",
  "pane-title": "h2",
  "pane-summary": "p",
  "pane-meta": "span",
  "strip-label": "span",
  "transcript-actor": "span",
  "transcript-meta": "span",
  "detail-label": "span",
  "detail-value": "p",
  "payload-label": "span",
  "inspector-title": "h2",
  "inspector-summary": "p"
}

const roleClassNames: Record<SemanticRole, string> = {
  "display-lg":
    "font-family-(--ui-type-display-lg-family) text-(length:--ui-type-display-lg-size) leading-(--ui-type-display-lg-leading) font-weight-(--ui-type-display-lg-weight) tracking-(--ui-type-display-lg-tracking) text-content-primary",
  display:
    "font-family-(--ui-type-display-family) text-(length:--ui-type-display-size) leading-(--ui-type-display-leading) font-weight-(--ui-type-display-weight) tracking-(--ui-type-display-tracking) text-content-primary",
  "display-sm":
    "font-family-(--ui-type-display-sm-family) text-(length:--ui-type-display-sm-size) leading-(--ui-type-display-sm-leading) font-weight-(--ui-type-display-sm-weight) tracking-(--ui-type-display-sm-tracking) text-content-primary",
  "body-lg":
    "font-family-(--ui-type-body-lg-family) text-(length:--ui-type-body-lg-size) leading-(--ui-type-body-lg-leading) font-weight-(--ui-type-body-lg-weight) tracking-(--ui-type-body-lg-tracking) text-content-secondary",
  body:
    "font-family-(--ui-type-body-family) text-(length:--ui-type-body-size) leading-(--ui-type-body-leading) font-weight-(--ui-type-body-weight) tracking-(--ui-type-body-tracking) text-content-secondary",
  "body-sm":
    "font-family-(--ui-type-body-sm-family) text-(length:--ui-type-body-sm-size) leading-(--ui-type-body-sm-leading) font-weight-(--ui-type-body-sm-weight) tracking-(--ui-type-body-sm-tracking) text-content-muted",
  eyebrow:
    "font-family-(--ui-type-eyebrow-family) text-(length:--ui-type-eyebrow-size) leading-(--ui-type-eyebrow-leading) font-weight-(--ui-type-eyebrow-weight) tracking-(--ui-type-eyebrow-tracking) text-content-subtle",
  label:
    "font-family-(--ui-type-label-family) text-(length:--ui-type-label-size) leading-(--ui-type-label-leading) font-weight-(--ui-type-label-weight) tracking-(--ui-type-label-tracking) text-content-muted",
  button:
    "font-family-(--ui-type-button-family) text-(length:--ui-type-button-size) leading-(--ui-type-button-leading) font-weight-(--ui-type-button-weight) tracking-(--ui-type-button-tracking)",
  badge:
    "font-family-(--ui-type-badge-family) text-(length:--ui-type-badge-size) leading-(--ui-type-badge-leading) font-weight-(--ui-type-badge-weight) tracking-(--ui-type-badge-tracking)",
  tab:
    "font-family-(--ui-type-tab-family) text-(length:--ui-type-tab-size) leading-(--ui-type-tab-leading) font-weight-(--ui-type-tab-weight) tracking-(--ui-type-tab-tracking)",
  status:
    "font-family-(--ui-type-status-family) text-(length:--ui-type-status-size) leading-(--ui-type-status-leading) font-weight-(--ui-type-status-weight) tracking-(--ui-type-status-tracking)",
  "workspace-title":
    "font-family-(--ui-type-workspace-title-family) text-(length:--ui-type-workspace-title-size) leading-(--ui-type-workspace-title-leading) font-weight-(--ui-type-workspace-title-weight) tracking-(--ui-type-workspace-title-tracking) text-content-primary",
  "workspace-summary":
    "font-family-(--ui-type-workspace-summary-family) text-(length:--ui-type-workspace-summary-size) leading-(--ui-type-workspace-summary-leading) font-weight-(--ui-type-workspace-summary-weight) tracking-(--ui-type-workspace-summary-tracking) text-content-secondary",
  "pane-title":
    "font-family-(--ui-type-pane-title-family) text-(length:--ui-type-pane-title-size) leading-(--ui-type-pane-title-leading) font-weight-(--ui-type-pane-title-weight) tracking-(--ui-type-pane-title-tracking) text-content-primary",
  "pane-summary":
    "font-family-(--ui-type-pane-summary-family) text-(length:--ui-type-pane-summary-size) leading-(--ui-type-pane-summary-leading) font-weight-(--ui-type-pane-summary-weight) tracking-(--ui-type-pane-summary-tracking) text-content-secondary",
  "pane-meta":
    "font-family-(--ui-type-pane-meta-family) text-(length:--ui-type-pane-meta-size) leading-(--ui-type-pane-meta-leading) font-weight-(--ui-type-pane-meta-weight) tracking-(--ui-type-pane-meta-tracking) text-pane-meta",
  "strip-label":
    "font-family-(--ui-type-strip-label-family) text-(length:--ui-type-strip-label-size) leading-(--ui-type-strip-label-leading) font-weight-(--ui-type-strip-label-weight) tracking-(--ui-type-strip-label-tracking) text-pane-meta",
  "transcript-actor":
    "font-family-(--ui-type-transcript-actor-family) text-(length:--ui-type-transcript-actor-size) leading-(--ui-type-transcript-actor-leading) font-weight-(--ui-type-transcript-actor-weight) tracking-(--ui-type-transcript-actor-tracking) text-content-secondary",
  "transcript-meta":
    "font-family-(--ui-type-transcript-meta-family) text-(length:--ui-type-transcript-meta-size) leading-(--ui-type-transcript-meta-leading) font-weight-(--ui-type-transcript-meta-weight) tracking-(--ui-type-transcript-meta-tracking) text-pane-meta",
  "detail-label":
    "font-family-(--ui-type-detail-label-family) text-(length:--ui-type-detail-label-size) leading-(--ui-type-detail-label-leading) font-weight-(--ui-type-detail-label-weight) tracking-(--ui-type-detail-label-tracking) text-detail-label",
  "detail-value":
    "font-family-(--ui-type-detail-value-family) text-(length:--ui-type-detail-value-size) leading-(--ui-type-detail-value-leading) font-weight-(--ui-type-detail-value-weight) tracking-(--ui-type-detail-value-tracking) text-detail-value",
  "payload-label":
    "font-family-(--ui-type-payload-label-family) text-(length:--ui-type-payload-label-size) leading-(--ui-type-payload-label-leading) font-weight-(--ui-type-payload-label-weight) tracking-(--ui-type-payload-label-tracking) text-detail-label",
  "inspector-title":
    "font-family-(--ui-type-inspector-title-family) text-(length:--ui-type-inspector-title-size) leading-(--ui-type-inspector-title-leading) font-weight-(--ui-type-inspector-title-weight) tracking-(--ui-type-inspector-title-tracking) text-content-primary",
  "inspector-summary":
    "font-family-(--ui-type-inspector-summary-family) text-(length:--ui-type-inspector-summary-size) leading-(--ui-type-inspector-summary-leading) font-weight-(--ui-type-inspector-summary-weight) tracking-(--ui-type-inspector-summary-tracking) text-pane-meta"
}

const toneClassNames: Record<SemanticTone, string> = {
  default: "text-content-primary",
  muted: "text-content-muted",
  subtle: "text-content-subtle",
  accent: "text-accent-solid",
  danger: "text-intent-danger-content",
  inherit: "text-inherit"
}

export type SemanticTextProps = {
  readonly as?: ElementType
  readonly children?: ReactNode
  readonly className?: string
  readonly role?: SemanticRole
  readonly tone?: SemanticTone
  readonly truncate?: boolean
} & Omit<BoxProps, "as" | "children" | "className">

export const SemanticText = ({
  as,
  children,
  className,
  role = "body",
  tone = "default",
  truncate = false,
  ...props
}: SemanticTextProps) => {
  const Component = as ?? roleElementMap[role]

  return (
    <Box
      {...props}
      as={Component}
      className={mergeClassNames(
        roleClassNames[role],
        toneClassNames[tone],
        truncate ? "truncate" : undefined,
        className
      )}
    >
      {children}
    </Box>
  )
}
