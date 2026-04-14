import { Result } from "@effect-atom/atom"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ArrowUpTrayIcon, ExclamationTriangleIcon, SparklesIcon } from "@heroicons/react/24/outline"

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
import { SearchField } from "../../../ui/components/form/SearchField.js"
import { Callout } from "../../../ui/components/surface/Callout.js"
import { Panel } from "../../../ui/components/surface/Panel.js"
import { SectionHeader } from "../../../ui/components/surface/SectionHeader.js"
import { Cluster } from "../../../ui/structure/Cluster.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { OpenInWorkflowAction } from "./OpenInWorkflowAction.js"

type ImportResult = Result.Result<AmpThreadImportPayload, OpenAgentTraceError>

const importWaiting = (result: ImportResult): boolean =>
  Result.match(result, {
    onInitial: (state) => state.waiting,
    onFailure: (state) => state.waiting,
    onSuccess: (state) => state.waiting
  })

const InteractionImportStatus = ({ result }: { readonly result: ImportResult }) =>
  Result.match(result, {
    onInitial: (state) =>
      state.waiting
        ? (
          <Callout
            description="The imported thread is being normalized into the open-agent-trace corpus lane."
            icon={SparklesIcon}
            title="Importing Amp thread"
            tone="info"
          />
        )
        : null,
    onFailure: (failure) => (
      <Callout
        description={failure.cause.toString()}
        icon={ExclamationTriangleIcon}
        title="Import failed"
        tone="danger"
      />
    ),
    onSuccess: (success) => (
      <Callout
        action={
          <OpenInWorkflowAction
            label="Open imported workflow"
            reference={workflowReferenceFromOpenAgentTraceEntry(success.value.registryEntry)}
          />
        }
        description={`Imported ${success.value.registryEntry.title} into this browser session.`}
        icon={SparklesIcon}
        title="Import complete"
        tone="positive"
      />
    )
  })

export const InteractionImportBar = () => {
  const draft = useAtomValue(ampThreadImportDraftAtom)
  const importResult = useAtomValue(importAmpThreadAtom)
  const runImport = useAtomSet(importAmpThreadAtom)
  const setDraft = useAtomSet(setAmpThreadImportDraftAtom)
  const waiting = importWaiting(importResult)

  return (
    <Panel padding="md" tone="accent">
      <Stack gap="md">
        <SectionHeader
          description="Paste an Amp thread URL or thread id to append imported interaction evidence beside the fixture-backed corpus lane."
          eyebrow="Amp thread import"
          title="Add interaction evidence"
        />
        <Cluster className="items-end" gap="md">
          <SearchField
            className="flex-1"
            disabled={waiting}
            hint="Supported sources: https://ampcode.com/threads/... or T-... ids"
            onValueChange={(value) => {
              setDraft(value)
            }}
            placeholder="Paste an Amp thread link or T-... id"
            value={draft}
          />
          <Button
            disabled={draft.trim().length === 0 || waiting}
            leadingIcon={ArrowUpTrayIcon}
            onClick={() => {
              runImport(undefined)
            }}
            tone="primary"
          >
            {waiting ? "Importing…" : "Import thread"}
          </Button>
        </Cluster>
        <InteractionImportStatus result={importResult} />
      </Stack>
    </Panel>
  )
}
