import { Button } from "@base-ui/react/button"
import { Match } from "effect"

import type {
  ActionKind,
  ActionModel,
  ActionStatus,
  PayloadModel
} from "../../../../contracts/presentation/interactions.js"

import { EvidenceRows } from "../EvidenceRows.js"
import { Cluster, Layer, Stack } from "../Layout.js"
import { SemanticText } from "../SemanticText.js"
import {
  actionEyebrowClassName,
  actionFrameClassName,
  actionHeaderClassName,
  actionMetaClassName,
  actionMetaTextClassName,
  actionStatusClassName,
  actionTitleClassName,
  actionTitleRailClassName
} from "../theme/action.js"
import {
  interactionPayloadClassName,
  interactionPayloadSurfaceClassName,
  interactionSectionClassName,
  interactionSectionDividerClassName,
  interactionSectionTitleClassName
} from "../theme/interaction.js"

const actionKindLabel = (kind: ActionKind): string =>
  Match.value(kind).pipe(
    Match.when("tool", () => "Tool"),
    Match.when("command", () => "Command"),
    Match.when("runtime", () => "Runtime"),
    Match.when("custom", () => "Action"),
    Match.exhaustive
  )

const actionStatusLabel = (status: ActionStatus): string =>
  Match.value(status).pipe(
    Match.when("default", () => "ready"),
    Match.when("active", () => "running"),
    Match.when("success", () => "complete"),
    Match.when("error", () => "error"),
    Match.exhaustive
  )

const ActionPayload = ({ payload }: { readonly payload: PayloadModel }) => (
  <Stack className={interactionSectionClassName}>
    <Stack className="gap-2">
      {payload.title === undefined
        ? null
        : (
          <SemanticText
            as="span"
            className={interactionSectionTitleClassName}
            role="row-label"
            text={payload.title}
            variant="compact"
          />
        )}
      <Layer className={interactionPayloadSurfaceClassName}>
        <SemanticText
          as="p"
          className={interactionPayloadClassName(payload.format)}
          role="code-block"
          text={payload.payload}
          variant="expanded"
          wrapAuthority="native-browser"
        />
      </Layer>
    </Stack>
  </Stack>
)

const actionInteractiveClassName = ({
  action,
  interactive,
  selected
}: {
  readonly action: ActionModel
  readonly interactive: boolean
  readonly selected: boolean
}): string =>
  [
    actionFrameClassName({ kind: action.kind, status: action.status }),
    interactive
      ? "cursor-pointer text-left transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px"
      : "",
    interactive && !selected ? "hover:border-ink-400/70 hover:shadow-float" : "",
    selected ? "border-ink-900/90 ring-2 ring-ink-900/14 shadow-float" : "",
    interactive
      ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-2"
      : ""
  ].filter((value) => value.length > 0).join(" ")

export const Action = ({
  action,
  onSelect,
  selected = false
}: {
  readonly action: ActionModel
  readonly onSelect?: () => void
  readonly selected?: boolean
}) => {
  const interactive = onSelect !== undefined
  const content = (
    <Stack className="gap-3.5">
      <Stack className={actionHeaderClassName}>
        <Cluster className={actionTitleRailClassName}>
          <Stack className="gap-0.5">
            <SemanticText
              as="span"
              className={actionEyebrowClassName}
              role="row-label"
              text={actionKindLabel(action.kind)}
              variant="compact"
            />
            <SemanticText
              as="span"
              className={actionTitleClassName}
              role="row-value"
              text={action.label}
              variant="expanded"
            />
          </Stack>
          <SemanticText
            as="span"
            className={actionStatusClassName(action.status)}
            role="code-meta"
            text={actionStatusLabel(action.status)}
            variant="compact"
          />
        </Cluster>
        {action.supportingText === undefined && action.callId === undefined
          ? null
          : (
            <Cluster className={actionMetaClassName}>
              {action.supportingText === undefined
                ? null
                : (
                  <SemanticText
                    as="span"
                    className={actionMetaTextClassName}
                    role="code-meta"
                    text={action.supportingText}
                    variant="compact"
                  />
                )}
              {action.callId === undefined
                ? null
                : (
                  <SemanticText
                    as="span"
                    className={actionMetaTextClassName}
                    role="code-meta"
                    text={`call ${action.callId}`}
                    variant="compact"
                  />
                )}
            </Cluster>
          )}
      </Stack>
      {action.details.length === 0
        ? null
        : (
          <>
            <Layer aria-hidden="true" className={interactionSectionDividerClassName} />
            <Stack className={interactionSectionClassName}>
              <SemanticText
                as="span"
                className={interactionSectionTitleClassName}
                role="row-label"
                text="Details"
                variant="compact"
              />
              <EvidenceRows density="compact" rows={action.details} variant="expanded" />
            </Stack>
          </>
        )}
      {action.input === undefined && action.output === undefined
        ? null
        : (
          <>
            <Layer aria-hidden="true" className={interactionSectionDividerClassName} />
            <Stack className="gap-3">
              {action.input === undefined ? null : <ActionPayload payload={action.input} />}
              {action.output === undefined ? null : <ActionPayload payload={action.output} />}
            </Stack>
          </>
        )}
    </Stack>
  )

  return (
    interactive
      ? (
        <Button
          aria-label={`Inspect ${action.kind} ${action.label}`}
          aria-pressed={selected}
          className={actionInteractiveClassName({ action, interactive, selected })}
          onClick={() => {
            onSelect()
          }}
          type="button"
        >
          {content}
        </Button>
      )
      : <Layer className={actionInteractiveClassName({ action, interactive, selected })}>{content}</Layer>
  )
}
