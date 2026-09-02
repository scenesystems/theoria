import { LockOpenIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"

import type { ProposalRecord, SealedNote } from "../../../contracts/imagined-place-result.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { contentCardToneClassesFor, toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { StatusPill } from "../primitives/StatusPill.js"
import { TagBadge } from "../primitives/TagBadge.js"
import { ToggleSwitch } from "../primitives/ToggleSwitch.js"

import { offeredByText, participantLabel, participantTone, shortId, signatureLabel } from "./placeViewModel.js"

const signaturePillClassName = (valid: boolean): string =>
  valid
    ? "border border-stage-200/90 bg-stage-0/80 text-ink-700"
    : "border border-danger-200/80 bg-danger-50/70 text-danger-700"

/** A note only the author can read, shown opened: the lock is the object, the text is the content. */
const OpenedNote = ({ note }: { readonly note: SealedNote }) => {
  const tone = toneClassesFor("seal")
  return (
    <Layer
      className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 rounded-md border px-3 py-2.5 ${tone.borderSubtle} ${tone.bgTinted}`}
    >
      <LockOpenIcon aria-hidden className={`mt-0.5 size-3.5 ${tone.text}`} />
      <Stack className="min-w-0 gap-1">
        <SemanticText as="span" className={tone.text} role="code-meta" text="Sealed note · opened with your key" />
        <SemanticText
          as="p"
          className="text-ink-800"
          role="card-summary"
          text={`“${note.openedText}”`}
          variant="compact"
          wrapAuthority="native-browser"
        />
      </Stack>
    </Layer>
  )
}

/**
 * One proposal offered to the author: who offered it and how they came to,
 * what it is, why they think the place needs it. The card carries its own
 * content ID and its proposer's signature whether or not it is merged: a
 * declined proposal stays credited to whoever offered it. `accepted` is the visitor's current
 * choice, which may be ahead of the build in flight.
 */
export const PlaceProposalCard = ({
  accepted,
  disabled,
  note,
  onToggle,
  record
}: {
  readonly accepted: boolean
  readonly disabled: boolean
  readonly note: Option.Option<SealedNote>
  readonly onToggle: () => void
  readonly record: ProposalRecord
}) => {
  const role = record.proposal.proposer
  const tone = toneClassesFor(participantTone(role))
  const cardTone = accepted ? { tone: contentCardToneClassesFor(participantTone(role)) } : {}

  return (
    <ContentCard
      className={`h-full ${accepted ? "border-solid" : "border-dashed"}`}
      density="compact"
      {...cardTone}
    >
      <Layer className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <Stack className="min-w-0 gap-1.5">
          <Cluster className="items-center gap-x-2 gap-y-1">
            <TagBadge name={participantLabel(role)} tone={tone} />
            <SemanticText
              as="span"
              className="text-ink-500"
              role="code-meta"
              text={offeredByText(record)}
              wrapAuthority="native-browser"
            />
          </Cluster>
          <SemanticText
            as="h3"
            className="text-ink-900"
            role="card-title"
            text={record.proposal.feature.name}
            variant="compact"
            wrapAuthority="native-browser"
          />
        </Stack>
        <ToggleSwitch
          checked={accepted}
          disabled={disabled}
          label={accepted ? "Merged" : "Merge"}
          onToggle={onToggle}
          tone={tone}
        />
      </Layer>

      <SemanticText
        as="p"
        className="text-ink-700"
        role="card-summary"
        text={record.proposal.feature.description}
        variant="compact"
        wrapAuthority="native-browser"
      />
      <SemanticText
        as="p"
        className="text-ink-500"
        role="status"
        text={record.proposal.feature.rationale}
        variant="compact"
        wrapAuthority="native-browser"
      />

      {Option.match(note, {
        onNone: () => null,
        onSome: (value) => <OpenedNote note={value} />
      })}

      <Cluster className="items-center gap-2">
        <StatusPill
          className={signaturePillClassName(record.signature.valid)}
          label={signatureLabel(record.signature)}
        />
        <SemanticText as="span" className="text-ink-500" role="code-meta" text={shortId(record.contentId)} />
      </Cluster>
    </ContentCard>
  )
}
