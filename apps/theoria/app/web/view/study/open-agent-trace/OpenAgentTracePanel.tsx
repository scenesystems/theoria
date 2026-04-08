import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"

import { openAgentTraceRegistryAtom } from "../../../atoms/workflow/open-agent-trace.js"
import { ContentCard } from "../../primitives/ContentCard.js"
import { toneFor } from "../../primitives/designSystem.js"
import { Cluster, Stack } from "../../primitives/Layout.js"
import { ExternalLink } from "../../primitives/Link.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { FailureState, RunningState } from "../../primitives/Skeleton.js"

import { type OpenAgentTraceEntryPanelModel, openAgentTracePanelModel } from "./model.js"

const tone = toneFor("dsp")

const SummaryRows = (
  { rows }: { readonly rows: ReadonlyArray<{ readonly label: string; readonly value: string }> }
) => (
  <Cluster className="gap-x-6 gap-y-3">
    {rows.map((row) => (
      <Stack className="gap-1" key={row.label}>
        <SemanticText as="span" className="text-ink-500" role="row-label" text={row.label} variant="compact" />
        <SemanticText as="span" className="text-ink-900" role="row-value" text={row.value} variant="expanded" />
      </Stack>
    ))}
  </Cluster>
)

const DetailCard = (props: {
  readonly emptyText: string
  readonly items: ReadonlyArray<{ readonly detail: string; readonly label: string }>
  readonly title: string
}) => (
  <ContentCard className="min-w-0 flex-1 basis-[18rem]" density="standard">
    <Stack className="gap-3">
      <SemanticText as="h3" className="text-ink-900" role="card-title" text={props.title} variant="compact" />
      {props.items.length === 0
        ? <SemanticText as="p" className="text-ink-700" role="card-summary" text={props.emptyText} variant="expanded" />
        : (
          <Stack className="gap-3">
            {props.items.map((item) => (
              <Stack className="gap-1" key={item.label}>
                <SemanticText as="span" className="text-ink-900" role="row-value" text={item.label} variant="compact" />
                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="card-summary"
                  text={item.detail}
                  variant="expanded"
                />
              </Stack>
            ))}
          </Stack>
        )}
    </Stack>
  </ContentCard>
)

const SummaryCard = (props: {
  readonly href?: string
  readonly rows: ReadonlyArray<{ readonly label: string; readonly value: string }>
  readonly title: string
}) => (
  <ContentCard className="min-w-0 flex-1 basis-[18rem]" density="standard">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText as="h3" className="text-ink-900" role="card-title" text={props.title} variant="compact" />
        {props.href === undefined
          ? null
          : (
            <ExternalLink className="text-ink-700 underline decoration-stage-300 underline-offset-4" href={props.href}>
              <SemanticText as="span" role="row-label" text={props.href} variant="compact" />
            </ExternalLink>
          )}
      </Stack>
      <SummaryRows rows={props.rows} />
    </Stack>
  </ContentCard>
)

const EntrySection = ({ entry }: { readonly entry: OpenAgentTraceEntryPanelModel }) => (
  <Stack className="gap-4">
    <ContentCard className={tone.border} density="standard" shape="left-accent">
      <Stack className="gap-3">
        <SemanticText as="h3" className="text-ink-900" role="section-title" text={entry.title} variant="expanded" />
        <SemanticText as="p" className="text-ink-700" role="card-summary" text={entry.summary} variant="expanded" />
      </Stack>
    </ContentCard>

    <Cluster className="items-start gap-3">
      <SummaryCard href={entry.sourceHref} rows={entry.sourceRows} title="Corpus Source" />
      <SummaryCard rows={entry.redactionRows} title="Redaction Status" />
      <SummaryCard rows={entry.digestRows} title="Digests" />
    </Cluster>

    <Cluster className="items-start gap-3">
      <DetailCard emptyText="No normalized events were preserved." items={entry.traceEventItems} title="Active Trace" />
      <DetailCard
        emptyText="No abandoned branches were preserved on this active path."
        items={entry.branchItems}
        title="Branch Tree"
      />
    </Cluster>

    <Cluster className="items-start gap-3">
      <SummaryCard rows={entry.workflowRows} title="Projected Workflow" />
      <DetailCard emptyText="No graph nodes were projected." items={entry.graphNodeItems} title="Workflow Nodes" />
      <DetailCard emptyText="No graph edges were projected." items={entry.graphEdgeItems} title="Workflow Edges" />
    </Cluster>

    <Cluster className="items-start gap-3">
      <DetailCard
        emptyText="No workflow evaluation cases were projected."
        items={entry.workflowCaseItems}
        title="Evaluation Cases"
      />
      <DetailCard
        emptyText="No assistant usage provenance was preserved on this record."
        items={entry.usageItems}
        title="Usage Provenance"
      />
    </Cluster>

    <DetailCard
      emptyText="This projected record emitted no explicit coverage gaps."
      items={entry.coverageItems.map((item) => ({
        label: `${item.label} · ${item.severity}`,
        detail: item.detail
      }))}
      title="Coverage Gaps"
    />
  </Stack>
)

export const OpenAgentTracePanel = () => {
  const registryResult = useAtomValue(openAgentTraceRegistryAtom)

  return Result.match(registryResult, {
    onInitial: () => <RunningState text="Loading open-agent-trace corpus lane…" />,
    onFailure: (failure) => <FailureState description={failure.cause.toString()} />,
    onSuccess: (success) => {
      const model = openAgentTracePanelModel(success.value)

      return (
        <Stack className="gap-5">
          <ContentCard className={tone.border} density="standard" shape="left-accent">
            <Stack className="gap-3">
              <SemanticText
                as="h2"
                className="text-ink-900"
                role="section-title"
                text="Open-agent-trace corpus lane"
                variant="expanded"
              />
              <SemanticText
                as="p"
                className="text-ink-700"
                role="card-summary"
                text="The same effect-dsp proving consumer now surfaces the experimental pi-mono corpus lane as trace structure, workflow projection, evaluation prompts, usage provenance, and explicit coverage rather than a standalone metadata page."
                variant="expanded"
              />
              <SummaryRows rows={model.summaryRows} />
            </Stack>
          </ContentCard>

          {model.entries.map((entry) => <EntrySection entry={entry} key={entry.entryId} />)}
        </Stack>
      )
    }
  })
}
