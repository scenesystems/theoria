import type { OpenAgentTraceStudyMaterialCardModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { SurfaceSubsection } from "../../primitives/SurfaceSubsection.js"

export const OpenAgentTraceStudyMaterialCard = ({
  model
}: {
  readonly model: OpenAgentTraceStudyMaterialCardModel
}) => (
  <SurfaceSubsection appearance="flush" className="min-w-0 flex-1" summary={model.description} title={model.title}>
    <Stack className="gap-3">
      {model.items.length === 0
        ? (
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={model.emptyText}
            variant="expanded"
          />
        )
        : (
          <Stack className="gap-3">
            {model.items.map((item, index) => (
              <Stack className="gap-1" key={`${model.key}-${item.label}-${index}`}>
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
  </SurfaceSubsection>
)
