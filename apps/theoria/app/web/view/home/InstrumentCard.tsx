import { Separator } from "@base-ui-components/react/separator"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"

import { type Card, cardVisibleInReleaseStage } from "../../../contracts/card.js"
import { cardLiftSpring } from "../../atoms/card-lift.js"
import { packageVersionsAtom } from "../../atoms/package-versions.js"
import { useSpringLift } from "../../atoms/spring.js"
import { runtimeReleaseStage } from "../../runtime/release-stage.js"
import type { MetaItem } from "../primitives/CardMetaRow.js"
import { CardMetaRow } from "../primitives/CardMetaRow.js"
import { ContentCard } from "../primitives/ContentCard.js"
import type { ToneClasses } from "../primitives/designSystem.js"
import { Cluster, Layer } from "../primitives/Layout.js"
import { CardLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

const metaItems = (card: Card, version: string): ReadonlyArray<MetaItem> => [
  { _tag: "link", label: `npm@${version}`, href: card.npmUrl },
  { _tag: "link", label: "Source", href: card.repoUrl },
  { _tag: "text", label: card.license }
]

const liftPx = 3
const liftScale = 0.008

const liftTransform = (progress: number): string | undefined =>
  progress === 0
    ? undefined
    : `translateY(${(-progress * liftPx).toFixed(2)}px) scale(${(1 + progress * liftScale).toFixed(4)})`

const neutralBadgeClassName =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stage-200/90 px-2.5 py-1"

export const InstrumentCard = ({
  card,
  tone
}: {
  readonly card: Card
  readonly tone: ToneClasses
}) => {
  const { progress, onPointerEnter, onPointerLeave } = useSpringLift(cardLiftSpring, card.id)
  const versionsResult = useAtomValue(packageVersionsAtom)
  const resolvedVersion = Result.match(versionsResult, {
    onInitial: () => card.version,
    onSuccess: (success) => success.value[card.packageName] ?? card.version,
    onFailure: () => card.version
  })
  const releaseStage = runtimeReleaseStage()
  const titleIsLinked = cardVisibleInReleaseStage(card, releaseStage)
  const badge = Match.value(card.releaseState).pipe(
    Match.when("coming-soon", () => ({
      className: `${neutralBadgeClassName} text-ink-500`,
      icon: false,
      text: "Coming Soon"
    })),
    Match.orElse(() => ({
      className:
        `inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-150 ${tone.bgSubtle} ${tone.textStrong}`,
      icon: true,
      text: "Live Demo"
    }))
  )

  return (
    <ContentCard
      className={`relative h-full ${tone.border}`}
      density="standard"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      shape="left-accent"
      style={{ transform: liftTransform(progress) }}
    >
      <Cluster className="items-start justify-between gap-3">
        {titleIsLinked
          ? (
            <CardLink className="min-w-0 flex-1" href={card.deepDivePath}>
              <SemanticText as="h3" className="text-ink-900" role="card-title" text={card.title} variant="compact" />
            </CardLink>
          )
          : (
            <SemanticText
              as="h3"
              className="min-w-0 flex-1 text-ink-900"
              role="card-title"
              text={card.title}
              variant="compact"
            />
          )}
        <Layer
          as="span"
          className={badge.className}
        >
          <SemanticText as="span" role="tab-label" text={badge.text} variant="compact" />
          {badge.icon
            ? <ArrowTopRightOnSquareIcon aria-hidden className="h-3 w-3 shrink-0" />
            : null}
        </Layer>
      </Cluster>

      <SemanticText
        as="p"
        className="line-clamp-2 min-h-[2lh] min-w-0 text-ink-700"
        role="card-summary"
        text={card.useCase}
        variant="compact"
      />

      <Separator className="mt-auto h-px bg-stage-200/80" />

      <CardMetaRow
        className="relative z-10"
        items={metaItems(card, resolvedVersion)}
      />
    </ContentCard>
  )
}
