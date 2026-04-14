import type { HomeCatalogCardPresentation } from "../../../contracts/presentation/home-catalog.js"
import { cardLiftSpring } from "../../atoms/card-lift.js"
import { useSpringLift } from "../../atoms/spring.js"
import { StatusPill } from "../../ui/components/feedback/StatusPill.js"
import { Card } from "../../ui/components/surface/Card.js"
import { Box } from "../../ui/structure/Box.js"
import { Cluster } from "../../ui/structure/Cluster.js"
import { Link } from "../../ui/structure/Link.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"

const liftPx = 3
const shadowScale = 1.5

const renderMetaItem = (item: HomeCatalogCardPresentation["metaItems"][number], index: number) => {
  const content = (
    <SemanticText role="label" tone="inherit">
      {item.label}
    </SemanticText>
  )

  if (item._tag === "text") {
    return <Box as="span" key={index} className="text-content-subtle">{content}</Box>
  }

  return (
    <Link
      className="transition-opacity duration-150 ease-out hover:opacity-100"
      href={item.href}
      key={index}
      rel={item._tag === "external-link" ? "noopener noreferrer" : undefined}
      target={item._tag === "external-link" ? "_blank" : undefined}
      tone="muted"
    >
      {content}
    </Link>
  )
}

const docsMetaItem = (
  card: HomeCatalogCardPresentation
): HomeCatalogCardPresentation["metaItems"][number] | undefined =>
  card.metaItems.find((item) => item._tag === "internal-link" && item.label === "Docs")

const nonDocsMetaItems = (card: HomeCatalogCardPresentation): HomeCatalogCardPresentation["metaItems"] =>
  card.metaItems.filter((item) => !(item._tag === "internal-link" && item.label === "Docs"))

export const InstrumentCard = ({
  card
}: {
  readonly card: HomeCatalogCardPresentation
}) => {
  const docs = docsMetaItem(card)
  const filteredMeta = nonDocsMetaItems(card)
  const { progress, onPointerEnter, onPointerLeave } = useSpringLift(cardLiftSpring, card.id)

  return (
    <Card
      className="relative h-full overflow-hidden border-stage-200/80 bg-surface-panel/92 shadow-ui-chip"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      padding="lg"
      style={{
        transform: `translateY(${String(-progress * liftPx)}px)`,
        boxShadow: progress > 0
          ? `0 ${String(18 + progress * 12)}px ${String(60 - progress * 10)}px -52px rgba(15,23,42,${
            String(0.42 + progress * 0.15 * shadowScale)
          })`
          : undefined
      }}
      tone="muted"
    >
      <Box as="span" aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-tone-digest-400" />
      <Stack className="relative z-10 h-full gap-5 pl-2">
        <Box className="absolute right-0 top-0">
          {docs !== undefined && docs._tag === "internal-link"
            ? (
              <Link href={docs.href} tone="inherit">
                <StatusPill tone="neutral">{card.status.text}</StatusPill>
              </Link>
            )
            : <StatusPill tone="neutral">{card.status.text}</StatusPill>}
        </Box>

        <Stack className="gap-3">
          {card.titlePath === null
            ? <SemanticText as="h3" className="text-content-primary" role="display">{card.title}</SemanticText>
            : (
              <Link href={card.titlePath} tone="inherit">
                <SemanticText as="h3" className="text-content-primary" role="display">
                  {card.title}
                </SemanticText>
              </Link>
            )}

          <SemanticText className="text-content-muted" role="body">{card.description}</SemanticText>
        </Stack>

        <Cluster className="mt-auto border-t border-stage-200/80 pt-4 text-content-subtle" gap="xs">
          {filteredMeta.flatMap((item, index) =>
            index === 0
              ? [renderMetaItem(item, index)]
              : [
                <SemanticText key={`separator-${index}`} role="label" tone="subtle">
                  {"·"}
                </SemanticText>,
                renderMetaItem(item, index)
              ]
          )}
        </Cluster>
      </Stack>
    </Card>
  )
}
