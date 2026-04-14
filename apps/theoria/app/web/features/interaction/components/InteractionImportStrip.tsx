import { Result } from "@effect-atom/atom"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ArrowUpTrayIcon, SparklesIcon } from "@heroicons/react/24/outline"

import { workflowReferenceFromOpenAgentTraceEntry } from "../../../../contracts/study/workflow/catalog.js"
import type {
  AmpThreadImportPayload,
  OpenAgentTraceError
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import {
  ampThreadImportDraftAtom,
  importAmpThreadAtom,
  setAmpThreadImportDraftAtom
} from "../../../atoms/workflow/open-agent-trace.js"
import { Button } from "../../../ui/components/action/Button.js"
import { Badge } from "../../../ui/components/feedback/Badge.js"
import { SearchField } from "../../../ui/components/form/SearchField.js"
import { Box } from "../../../ui/structure/Box.js"
import { Cluster } from "../../../ui/structure/Cluster.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { OpenInWorkflowAction } from "./OpenInWorkflowAction.js"

type ImportResult = Result.Result<AmpThreadImportPayload, OpenAgentTraceError>

const importWaiting = (result: ImportResult): boolean =>
  Result.match(result, {
    onInitial: (state) => state.waiting,
    onFailure: (state) => state.waiting,
    onSuccess: (state) => state.waiting
  })

const InteractionImportResult = ({ result }: { readonly result: ImportResult }) =>
  Result.match(result, {
    onInitial: (state) =>
      state.waiting
        ? (
          <Cluster gap="sm">
            <Badge tone="info">Importing</Badge>
            <SemanticText role="pane-meta">
              The imported Amp thread is being normalized into the interaction corpus lane.
            </SemanticText>
          </Cluster>
        )
        : null,
    onFailure: (failure) => (
      <Cluster gap="sm">
        <Badge tone="danger">Import failed</Badge>
        <SemanticText role="pane-meta">{failure.cause.toString()}</SemanticText>
      </Cluster>
    ),
    onSuccess: (success) => (
      <Stack gap="sm">
        <Cluster gap="sm">
          <Badge tone="positive">Imported</Badge>
          <SemanticText role="pane-meta">
            {`Imported ${success.value.registryEntry.title} into this browser session.`}
          </SemanticText>
        </Cluster>
        <Box>
          <OpenInWorkflowAction
            label="Open imported workflow"
            reference={workflowReferenceFromOpenAgentTraceEntry(success.value.registryEntry)}
          />
        </Box>
      </Stack>
    )
  })

export const InteractionImportStrip = () => {
  const draft = useAtomValue(ampThreadImportDraftAtom)
  const importResult = useAtomValue(importAmpThreadAtom)
  const runImport = useAtomSet(importAmpThreadAtom)
  const setDraft = useAtomSet(setAmpThreadImportDraftAtom)
  const waiting = importWaiting(importResult)

  return (
    <Stack gap="sm">
      <Cluster className="items-end" gap="md">
        <SearchField
          className="flex-1"
          disabled={waiting}
          hint="Paste an Amp thread URL or T-... id to append live trace evidence."
          onValueChange={(value) => {
            setDraft(value)
          }}
          placeholder="Paste an Amp thread link or T-... id"
          value={draft}
        />
        <Button
          disabled={draft.trim().length === 0 || waiting}
          leadingIcon={waiting ? SparklesIcon : ArrowUpTrayIcon}
          onClick={() => {
            runImport(undefined)
          }}
          size="sm"
          tone="primary"
        >
          {waiting ? "Importing…" : "Import thread"}
        </Button>
      </Cluster>
      <InteractionImportResult result={importResult} />
    </Stack>
  )
}
