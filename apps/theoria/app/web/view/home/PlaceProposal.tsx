import { Collapsible } from "@base-ui/react/collapsible"
import { useAtomValue } from "@effect-atom/atom-react"
import { LockClosedIcon, LockOpenIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"
import type { ReactNode } from "react"

import type { PlaceMark } from "../../../contracts/demo/imagined-place-provenance.js"
import type { PlaceEvidence, ProposalRecord, SealedNote } from "../../../contracts/imagined-place-result.js"
import { placeProposalLineAtom } from "../../atoms/imagined-place-render.js"
import {
  dangerStatusTone,
  focusEdgeClassName,
  inlineStatusToneFor,
  neutralStatusTone,
  toneClassesFor
} from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { ParticipantName } from "../primitives/ParticipantName.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ToggleSwitch } from "../primitives/ToggleSwitch.js"

import { ContentId } from "./ContentId.js"
import { inlineMarkClassName, ProvenanceMark, StatusMark } from "./PlaceProvenance.js"
import {
  currentVersion,
  mergedIntoText,
  participantLabel,
  participantTone,
  sealedNoteLabel,
  signatureLabel
} from "./placeViewModel.js"

const sealTone = toneClassesFor("seal")

const signatureTone = (valid: boolean) => valid ? neutralStatusTone : dangerStatusTone

/**
 * The voice's rule: a proposer's accent while their proposal is merged, a
 * dashed neutral hairline while it is declined. It is the only edge the
 * proposal has; there is no box behind the words.
 */
const voiceClassName = (accepted: boolean, tone: { readonly border: string }): string =>
  accepted ? `border-solid ${tone.border}` : "border-dashed border-rule-strong"

/**
 * One labelled part of the proposal: the label names what the text is. A
 * label with a mark is a mark: the note's label answers with how the note
 * was sealed.
 */
const Field = ({ children, label, mark = Option.none() }: {
  readonly children: ReactNode
  readonly label: string
  readonly mark?: Option.Option<PlaceMark>
}) => (
  <>
    <Layer render={<dt />} className="pt-2 first:pt-0 sm:pt-0">
      {Option.match(mark, {
        onNone: () => (
          <SemanticText as="span" className="text-ink-500" role="row-label" text={label} variant="compact" />
        ),
        onSome: (value) => (
          <ProvenanceMark className={inlineMarkClassName} mark={value}>
            <SemanticText as="span" className="text-ink-500" role="row-label" text={label} variant="compact" />
          </ProvenanceMark>
        )
      })}
    </Layer>
    <Layer render={<dd />} className="min-w-0">{children}</Layer>
  </>
)

const foldTriggerClassName =
  `group/fold -mx-1.5 -my-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-stage-100/80 ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink-900/20`

const foldPanelClassName =
  "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none"

/**
 * The neighbor's note is a fold. Closed, it is the envelope: the seal and its
 * size, which is all anyone but the author can see. Opened with the author's
 * key, it is their words, quoted, on the seal tone's rule.
 */
const SealedNoteFold = ({ note }: { readonly note: SealedNote }) => (
  <Collapsible.Root className="min-w-0" data-place-sealed-note>
    <Collapsible.Trigger className={foldTriggerClassName}>
      <LockClosedIcon
        aria-hidden
        className={`size-3.5 shrink-0 group-data-[panel-open]/fold:hidden ${sealTone.text}`}
      />
      <LockOpenIcon
        aria-hidden
        className={`hidden size-3.5 shrink-0 group-data-[panel-open]/fold:inline ${sealTone.text}`}
      />
      <SemanticText
        as="span"
        className={`hidden group-data-[panel-open]/fold:inline ${sealTone.text}`}
        role="tab-label"
        text="Opened with your key"
        variant="compact"
      />
      <SemanticText
        as="span"
        className={`group-data-[panel-open]/fold:hidden ${sealTone.text}`}
        role="tab-label"
        text={sealedNoteLabel(note)}
        variant="compact"
      />
    </Collapsible.Trigger>
    <Collapsible.Panel className={foldPanelClassName}>
      <Layer render={<blockquote />} className={`mt-2 border-l-2 pl-3 ${sealTone.border}`}>
        <SemanticText
          as="p"
          className="text-ink-800"
          role="row-value"
          text={`“${note.openedText}”`}
          variant="compact"
          wrapAuthority="native-browser"
        />
      </Layer>
    </Collapsible.Panel>
  </Collapsible.Root>
)

/**
 * The feature's name: what its disc on the stage is labelled with once the
 * author merges it. The name stays here in either case; the stage answers a
 * merge where the feature stands, with a ring while the search makes room
 * and the disc filling it when the search settles.
 */
const FeatureTitle = ({ name }: { readonly name: string }) => (
  <SemanticContent as="h3" className="self-start text-ink-900" role="card-title" variant="compact">
    <ProvenanceMark className={inlineMarkClassName} data-place-feature={name} mark={{ _tag: "Feature", name }}>
      {name}
    </ProvenanceMark>
  </SemanticContent>
)

/** Appears when the build records the merge: the same digest tone as the version it names. */
const recordedTone = inlineStatusToneFor("digest")
const recordedClassName =
  "transition-[opacity,translate] duration-300 ease-out starting:translate-x-1 starting:opacity-0 motion-reduce:transition-none"

/**
 * One proposal offered to the author, spoken in their voice: marginalia with
 * a rule in the proposer's accent down its left edge and no box. Header: who
 * offers it (the name) and the author's decision (the switch). Title: the
 * feature's name, which becomes its marker on the stage. Then three labelled
 * parts — what the proposal adds to the place, why the proposer thinks it
 * belongs, and (for the neighbor) the note sealed to the author. Footer: the
 * proposal's own signature and content ID, which it keeps whether or not it
 * is merged. `accepted` is the author's decision and is shown at once;
 * `record.accepted` is what the last build recorded, and puts the version's
 * name beside the badge. The two differ while a build is in flight, and the
 * article says so. `data-place-anchor-line` is the line of the drawn prose
 * where the proposal's sentence stands once merged: the margin it belongs
 * beside.
 */
export const PlaceProposal = ({
  accepted,
  evidence,
  note,
  onToggle,
  record
}: {
  readonly accepted: boolean
  readonly evidence: PlaceEvidence
  readonly note: Option.Option<SealedNote>
  readonly onToggle: () => void
  readonly record: ProposalRecord
}) => {
  const role = record.proposal.proposer
  const tone = toneClassesFor(participantTone(role))
  const pending = accepted === record.accepted ? {} : { "data-place-pending": "" }
  const anchor = Option.match(useAtomValue(placeProposalLineAtom(role)), {
    onNone: () => ({}),
    onSome: (line) => ({ "data-place-anchor-line": String(line) })
  })

  return (
    <Stack
      render={<article />}
      className={`h-full gap-3 border-l-2 pl-4 transition-colors duration-300 ${voiceClassName(accepted, tone)}`}
      data-place-proposal={role}
      data-place-recorded={record.accepted ? "true" : "false"}
      {...anchor}
      {...pending}
    >
      <Cluster render={<header />} className="items-center justify-between gap-x-3 gap-y-1.5">
        <Cluster className="items-center gap-x-3 gap-y-1">
          <ParticipantName name={participantLabel(role)} tone={tone} />
          {record.accepted
            ? (
              <StatusMark
                className={recordedClassName}
                label={mergedIntoText(evidence)}
                mark={{ _tag: "Digest", contentId: currentVersion(evidence).contentId }}
                tone={recordedTone}
              />
            )
            : null}
        </Cluster>
        <Layer className="ml-auto">
          <ToggleSwitch
            checked={accepted}
            disabled={false}
            label="Merge"
            onToggle={onToggle}
            subject={record.proposal.feature.name}
            tone={tone}
          />
        </Layer>
      </Cluster>

      <FeatureTitle name={record.proposal.feature.name} />

      <Layer
        render={<dl />}
        className="grid gap-y-1 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-3 sm:gap-y-2.5"
      >
        <Field label="Adds">
          <SemanticText
            as="p"
            className="text-ink-800"
            role="row-value"
            text={record.proposal.feature.description}
            variant="compact"
            wrapAuthority="native-browser"
          />
        </Field>
        <Field label="Why">
          <SemanticText
            as="p"
            className="text-ink-600"
            role="row-value"
            text={record.proposal.feature.rationale}
            variant="compact"
            wrapAuthority="native-browser"
          />
        </Field>
        {Option.match(note, {
          onNone: () => null,
          onSome: (value) => (
            <Field label="Note" mark={Option.some<PlaceMark>({ _tag: "Note" })}>
              <SealedNoteFold note={value} />
            </Field>
          )
        })}
      </Layer>

      <Cluster render={<footer />} className="items-center gap-x-3 gap-y-1">
        <StatusMark
          label={signatureLabel(record.signature)}
          mark={{ _tag: "Signature", subject: record.contentId }}
          tone={signatureTone(record.signature.valid)}
        />
        <ContentId form="short" id={record.contentId} />
      </Cluster>
    </Stack>
  )
}
