import type { WorkflowComparisonSurfaceViewModel } from "./surface-model.js"

import { ContentCard } from "../../primitives/ContentCard.js"
import { DataTable } from "../../primitives/DataTable.js"
import { Cluster, Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"

const detailText = (value: string): string => (value.length === 0 ? "n/a" : value)

export const WorkflowRichness = ({
  viewModel
}: {
  readonly viewModel: WorkflowComparisonSurfaceViewModel
}) => (
  <Stack className="gap-4">
    <ContentCard density="standard">
      <Stack className="gap-3">
        <Stack className="gap-1">
          <SemanticText
            as="h3"
            className="text-ink-900"
            role="section-title"
            text="Optimization Progress"
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={viewModel.progress.description}
            variant="expanded"
          />
        </Stack>

        <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {viewModel.progress.metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </Layer>

        <Layer className="grid gap-3 lg:grid-cols-2">
          <DataTable
            columns={["Field", "Value"]}
            label="Frozen optimization selections"
            rows={viewModel.progress.selectionRows}
          />

          {viewModel.progress.snapshotRows.length === 0
            ? (
              <ContentCard density="compact">
                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="status"
                  text="Snapshot facts appear here once the study has checkpointed a canonical optimization snapshot."
                  variant="expanded"
                />
              </ContentCard>
            )
            : (
              <DataTable
                columns={["Field", "Value"]}
                label="Optimization snapshot facts"
                rows={viewModel.progress.snapshotRows}
              />
            )}
        </Layer>

        {viewModel.progress.eventRows.length === 0
          ? (
            <SemanticText
              as="p"
              className="text-ink-700"
              role="status"
              text="Study event trace rows will stream here as the search lane advances through the bounded trial budget."
              variant="expanded"
            />
          )
          : (
            <DataTable
              columns={["#", "Event", "Detail"]}
              label="Optimization study event trace"
              rows={viewModel.progress.eventRows}
            />
          )}
      </Stack>
    </ContentCard>

    <ContentCard density="standard">
      <Stack className="gap-3">
        <Stack className="gap-1">
          <SemanticText
            as="h3"
            className="text-ink-900"
            role="section-title"
            text="Graph Comparison"
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={viewModel.graph.currentStep}
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={viewModel.graph.currentStepMeta}
            variant="expanded"
          />
        </Stack>

        <Layer className="grid gap-3 lg:grid-cols-3">
          {viewModel.graph.cards.map((card) => (
            <ContentCard density="compact" key={card.key}>
              <Stack className="gap-3">
                <Stack className="gap-1">
                  <SemanticText
                    as="h3"
                    className="text-ink-900"
                    role="section-title"
                    text={card.label}
                    variant="expanded"
                  />
                  <SemanticText
                    as="p"
                    className="text-ink-700"
                    role="status"
                    text={card.traversal}
                    variant="expanded"
                  />
                </Stack>

                <Cluster className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Score" value={card.score} />
                  <MetricCard label="Nodes" value={card.nodeCount} unit="count" />
                </Cluster>

                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="status"
                  text={card.detail}
                  variant="expanded"
                />
              </Stack>
            </ContentCard>
          ))}
        </Layer>
      </Stack>
    </ContentCard>

    <ContentCard density="standard">
      <Stack className="gap-3">
        <Stack className="gap-1">
          <SemanticText
            as="h3"
            className="text-ink-900"
            role="section-title"
            text="Transcript Evidence"
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={viewModel.transcript.description}
            variant="expanded"
          />
        </Stack>

        {viewModel.transcript.entries.length === 0
          ? (
            <SemanticText
              as="p"
              className="text-ink-700"
              role="status"
              text="No transcript rows yet. Run the proving surface to materialize node-level prompts and outputs."
              variant="expanded"
            />
          )
          : (
            <DataTable
              columns={["Variant", "Node", "Prompt", "Output", "Tokens", "Duration"]}
              label="Node-level transcript and output evidence"
              rows={viewModel.transcript.entries.map((entry) => [
                entry.variantLabel,
                entry.isCurrent ? `${entry.nodeId} (current)` : entry.nodeId,
                detailText(entry.prompt),
                detailText(entry.output),
                entry.totalTokens,
                entry.durationMs
              ])}
            />
          )}
      </Stack>
    </ContentCard>

    <ContentCard density="standard">
      <Stack className="gap-3">
        <Stack className="gap-1">
          <SemanticText
            as="h3"
            className="text-ink-900"
            role="section-title"
            text="Rendered Preview"
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={viewModel.renderedPreview.description}
            variant="expanded"
          />
        </Stack>

        <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {viewModel.renderedPreview.metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </Layer>

        <Layer className="grid gap-3 lg:grid-cols-2">
          {viewModel.renderedPreview.panes.map((pane) => (
            <ContentCard density="compact" key={pane.key}>
              <Stack className="gap-2">
                <Cluster className="items-baseline justify-between gap-3">
                  <SemanticText
                    as="h3"
                    className="text-ink-900"
                    role="section-title"
                    text={pane.label}
                    variant="expanded"
                  />
                  <SemanticText
                    as="p"
                    className="text-ink-700"
                    role="row-label"
                    text={`score ${pane.score}`}
                    variant="expanded"
                  />
                </Cluster>
                <SemanticText
                  as="p"
                  className="text-ink-900"
                  role="row-value"
                  text={pane.body}
                  variant="expanded"
                />
                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="status"
                  text={pane.note}
                  variant="expanded"
                />
              </Stack>
            </ContentCard>
          ))}
        </Layer>
      </Stack>
    </ContentCard>
  </Stack>
)
