import { Separator } from "@base-ui-components/react/separator"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"

import {
  type CapabilityAvailability,
  entryCapabilityAvailabilityFor
} from "../../../contracts/capability/availability.js"
import type { EntryError } from "../../../contracts/entry-error.js"
import { type Card, cardVisibleInReleaseStage } from "../../../contracts/entry/card.js"
import { capabilityAvailabilityAtom } from "../../atoms/capability-availability.js"
import { cardLiftSpring } from "../../atoms/card-lift.js"
import { packageVersionsAtom } from "../../atoms/package-versions.js"
import { useSpringLift } from "../../atoms/spring.js"
import { runtimeReleaseStage } from "../../runtime/release-stage.js"
import type { MetaItem } from "../primitives/CardMetaRow.js"
import { CardMetaRow } from "../primitives/CardMetaRow.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { CardLink } from "../primitives/Link.js"
import { SelectionRail } from "../primitives/SelectionLayout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import type { Tone } from "../primitives/theme/tone.js"

const metaItems = (card: Card, version: string): ReadonlyArray<MetaItem> => [
  { _tag: "internal-link", label: "Docs", href: card.docsPath },
  { _tag: "external-link", label: `npm@${version}`, href: card.npmUrl },
  { _tag: "external-link", label: "Source", href: card.repoUrl },
  { _tag: "text", label: card.license }
]

const liftPx = 3
const liftScale = 0.008

const liftTransform = (progress: number): string | undefined =>
  progress === 0
    ? undefined
    : `translateY(${(-progress * liftPx).toFixed(2)}px) scale(${(1 + progress * liftScale).toFixed(4)})`

const neutralBadgeClassName =
  "inline-flex shrink-0 items-center gap-1 rounded-full border border-stage-200/90 px-2 py-1"

type Badge = {
  readonly className: string
  readonly text: string
  readonly title: string
}

type CapabilityAvailabilityResult = Result.Result<CapabilityAvailability, EntryError>

const publishedBadgeClassName = (tone: Tone): string =>
  `inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 transition-colors duration-150 ${tone.bgSubtle} ${tone.textStrong}`

const checkingBadge: Badge = {
  className: `${neutralBadgeClassName} text-ink-700`,
  text: "Checking Status",
  title: "Theoria is resolving runtime readiness for this study entry."
}

const statusUnavailableBadge: Badge = {
  className: `${neutralBadgeClassName} text-ink-700`,
  text: "Status Unavailable",
  title: "Theoria could not confirm runtime readiness for this study entry."
}

const comingSoonBadge: Badge = {
  className: `${neutralBadgeClassName} text-ink-500`,
  text: "Coming Soon",
  title: "This study entry has not shipped yet."
}

const pendingBadge = (reason: string): Badge => ({
  className: `${neutralBadgeClassName} text-ink-700`,
  text: "Runtime Pending",
  title: reason
})

const readyBadge = (tone: Tone): Badge => ({
  className: publishedBadgeClassName(tone),
  text: "Ready",
  title: "Runtime readiness confirmed for this study entry."
})

const publishedBadge = ({
  availabilityResult,
  entryId,
  tone
}: {
  readonly availabilityResult: CapabilityAvailabilityResult
  readonly entryId: Card["id"]
  readonly tone: Tone
}): Badge =>
  Result.match(availabilityResult, {
    onInitial: () => checkingBadge,
    onFailure: () => statusUnavailableBadge,
    onSuccess: (success) =>
      Option.match(entryCapabilityAvailabilityFor(success.value, entryId), {
        onNone: () => pendingBadge("Runtime registration has not shipped for this study entry yet."),
        onSome: (entry) =>
          entry.enabled
            ? readyBadge(tone)
            : pendingBadge(entry.reason ?? "Runtime is not available for this study entry yet.")
      })
  })

export const InstrumentCard = ({
  card,
  tone
}: {
  readonly card: Card
  readonly tone: Tone
}) => {
  const { progress, onPointerEnter, onPointerLeave } = useSpringLift(cardLiftSpring, card.id)
  const availabilityResult = useAtomValue(capabilityAvailabilityAtom)
  const versionsResult = useAtomValue(packageVersionsAtom)
  const resolvedVersion = Result.match(versionsResult, {
    onInitial: () => card.version,
    onSuccess: (success) => success.value[card.packageName] ?? card.version,
    onFailure: () => card.version
  })
  const releaseStage = runtimeReleaseStage()
  const titleIsLinked = cardVisibleInReleaseStage(card, releaseStage)
  const badge = Match.value(card.releaseState).pipe(
    Match.when("coming-soon", () => comingSoonBadge),
    Match.orElse(() => publishedBadge({ availabilityResult, entryId: card.id, tone }))
  )
  const badgeSlot = (
    <Layer as="span" className={badge.className} title={badge.title}>
      <SemanticText as="span" role="status" text={badge.text} variant="compact" />
    </Layer>
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
      <Stack className="min-w-0 gap-3">
        <SelectionRail action={badgeSlot} className="gap-y-2">
          {titleIsLinked
            ? (
              <CardLink className="block min-w-0" href={card.deepDivePath}>
                <SemanticText
                  as="h3"
                  className="min-w-0 text-ink-900"
                  role="catalog-title"
                  text={card.title}
                  variant="compact"
                />
              </CardLink>
            )
            : (
              <SemanticText
                as="h3"
                className="min-w-0 text-ink-900"
                role="catalog-title"
                text={card.title}
                variant="compact"
              />
            )}
        </SelectionRail>

        <SemanticText
          as="p"
          className="min-w-0 text-ink-700"
          lineLimit={2}
          role="card-summary"
          reserveLines={2}
          text={card.description}
          variant="compact"
          wrapAuthority="effect-text-projected"
        />
      </Stack>

      <Separator className="mt-auto h-px bg-stage-200/80" />

      <CardMetaRow
        className="relative z-10"
        items={metaItems(card, resolvedVersion)}
      />
    </ContentCard>
  )
}
