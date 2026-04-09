import { ContentCard } from "../../primitives/ContentCard.js"
import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"

import type { OpenAgentTraceStudyMaterialCardModel } from "./panel-types.js"

export const OpenAgentTraceStudyMaterialCard = ({
  model
}: {
  readonly model: OpenAgentTraceStudyMaterialCardModel
}) => (
  <ContentCard className="min-w-0 flex-1 basis-[18rem]" density="standard">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText as="h3" className="text-ink-900" role="card-title" text={model.title} variant="expanded" />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="card-summary"
          text={model.description}
          variant="expanded"
        />
      </Stack>

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
  </ContentCard>
)
