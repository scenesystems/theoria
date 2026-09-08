import { Collapsible } from "@base-ui/react/collapsible"
import { LockClosedIcon, LockOpenIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import type { PlaceMark } from "../../../contracts/demo/imagined-place-provenance.js"
import type { PlaceBuild, ProposalRecord, SealedNote } from "../../../contracts/imagined-place-result.js"
import {
  type OfferedProposal,
  type ParticipantRole,
  sealedNoteSender,
  type VersionShape
} from "../../../contracts/imagined-place.js"
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
import { GhostText } from "../primitives/Skeleton.js"
import { ToggleSwitch } from "../primitives/ToggleSwitch.js"

import { ContentId, ContentIdPending } from "./ContentId.js"
import {
  inlineMarkClassName,
  inlineMarkRoomClassName,
  ProvenanceMark,
  StatusMark,
  StatusMarkPending
} from "./PlaceProvenance.js"
import {
  currentVersion,
  mergedIntoText,
  participantLabel,
  participantTone,
  sealedNoteLabel,
  sealedNoteLabelShape,
  signatureLabel,
  signatureLabelShape
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
 * was sealed. Beside the value the label is centred on the value's first
 * line — a line box the value's height — rather than set on its baseline: a
 * baseline shared between two type sizes lands a pixel apart from one face
 * to its metric stand-in, and the row with it.
 */
const Field = ({ children, label, mark = Option.none() }: {
  readonly children: ReactNode
  readonly label: string
  readonly mark?: Option.Option<PlaceMark>
}) => (
  <>
    <Layer render={<dt />} className="pt-2 first:pt-0 sm:flex sm:min-h-(--st-lh-row-value) sm:items-center sm:pt-0">
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

const foldTriggerLayoutClassName = "-mx-1.5 -my-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1"

const foldTriggerClassName =
  `group/fold ${foldTriggerLayoutClassName} text-left transition-colors duration-150 hover:bg-stage-100/80 ${focusEdgeClassName} focus-visible:ring-2 focus-visible:ring-ink-900/20`

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
 * The envelope before it is sealed: the closed fold's own layout, with the
 * seal's icon and the label's words as ghosts. Not a fold: there is nothing
 * yet to open.
 */
const SealedNoteFoldPending = () => (
  <Layer render={<span />} className={foldTriggerLayoutClassName} data-place-sealed-note-pending>
    <LockClosedIcon aria-hidden className={`size-3.5 shrink-0 ${sealTone.text}`} />
    <GhostText as="span" className={sealTone.text} role="tab-label" text={sealedNoteLabelShape} variant="compact" />
  </Layer>
)

/**
 * The note's part of the proposal, for the proposer who sends one: the
 * sealed envelope once the build has sealed it, and its room before that.
 * The build says who sent it; before the build, the contract does.
 */
const NoteField = ({ build, role }: {
  readonly build: Option.Option<PlaceBuild>
  readonly role: ParticipantRole
}) =>
  Option.match(build, {
    onNone: () =>
      role === sealedNoteSender
        ? (
          <Field label="Note">
            <SealedNoteFoldPending />
          </Field>
        )
        : null,
    onSome: (value) =>
      value.evidence.sealedNote.from === role
        ? (
          <Field label="Note" mark={Option.some<PlaceMark>({ _tag: "Note" })}>
            <SealedNoteFold note={value.evidence.sealedNote} />
          </Field>
        )
        : null
  })

/** The build's record of a proposer's proposal: what it signed and whether the author took it. */
const recordOf = (build: PlaceBuild, role: ParticipantRole): Option.Option<ProposalRecord> =>
  Arr.findFirst(build.proposals, (record) => record.proposal.proposer === role)

/**
 * The feature's name: what its disc on the stage is labelled with once the
 * author merges it. The name stays here in either case; the stage answers a
 * merge where the feature stands, with a ring while the search makes room
 * and the disc filling it when the search settles. Before the build the name
 * is the recording's, as a ghost in the mark's own padding, so the title's
 * line is the one the mark will stand in.
 */
const FeatureTitle = ({ name, recorded }: { readonly name: string; readonly recorded: boolean }) => (
  <SemanticContent as="h3" className="self-start text-ink-900" role="card-title" variant="compact">
    {recorded
      ? (
        <ProvenanceMark className={inlineMarkClassName} data-place-feature={name} mark={{ _tag: "Feature", name }}>
          {name}
        </ProvenanceMark>
      )
      : (
        <Layer render={<span />} className={inlineMarkRoomClassName}>
          <GhostText as="span" role="card-title" text={name} variant="compact" />
        </Layer>
      )}
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
 * is merged. `accepted` is the author's decision and is shown at once; the
 * build's record of the proposal says what the last build recorded, and puts
 * the version's name beside the badge. The two differ while a build is in
 * flight, and the article says so. Before any build the article is laid out
 * from the offer as the recording made it, with every word the build will
 * sign — the name, the signature, the ID, the version — as a ghost in its
 * place. The proposal's link to the drawn prose is the focus model's: its
 * name, pointed at, lights the line its sentence stands on, and that line,
 * pointed at, lights the name and the disc (`placeProvenance.lineAnswer`).
 */
export const PlaceProposal = ({
  accepted,
  build,
  mergedInto,
  offered,
  onToggle
}: {
  readonly accepted: boolean
  readonly build: Option.Option<PlaceBuild>
  readonly mergedInto: VersionShape
  readonly offered: OfferedProposal
  readonly onToggle: () => void
}) => {
  const role = offered.proposal.proposer
  const tone = toneClassesFor(participantTone(role))
  const record = Option.flatMap(build, (value) => recordOf(value, role))
  const recorded = Option.map(record, (value) => value.accepted)
  const pending = Option.match(recorded, {
    onNone: () => ({}),
    onSome: (value) => accepted === value ? {} : { "data-place-pending": "" }
  })
  // What the build signed, once it is here; the recording's words, which are the same words, before.
  const feature = Option.match(record, {
    onNone: () => offered.proposal.feature,
    onSome: (value) => value.proposal.feature
  })

  return (
    <Stack
      render={<article />}
      className={`h-full gap-3 border-l-2 pl-4 transition-colors duration-300 ${voiceClassName(accepted, tone)}`}
      data-place-proposal={role}
      {...Option.match(recorded, {
        onNone: () => ({}),
        onSome: (value) => ({ "data-place-recorded": value ? "true" : "false" })
      })}
      {...pending}
    >
      <Cluster render={<header />} className="items-center justify-between gap-x-3 gap-y-1.5">
        <Cluster className="items-center gap-x-3 gap-y-1">
          <ParticipantName name={participantLabel(role)} tone={tone} />
          {Option.match(build, {
            onNone: () =>
              offered.accepted
                ? <StatusMarkPending label={mergedIntoText(mergedInto)} tone={recordedTone} />
                : null,
            onSome: (value) =>
              Option.getOrElse(recorded, () => false)
                ? (
                  <StatusMark
                    className={recordedClassName}
                    label={mergedIntoText(currentVersion(value.evidence))}
                    mark={{ _tag: "Digest", contentId: currentVersion(value.evidence).contentId }}
                    tone={recordedTone}
                  />
                )
                : null
          })}
        </Cluster>
        <Layer className="ml-auto">
          <ToggleSwitch
            checked={accepted}
            disabled={false}
            label="Merge"
            onToggle={onToggle}
            subject={feature.name}
            tone={tone}
          />
        </Layer>
      </Cluster>

      <FeatureTitle name={feature.name} recorded={Option.isSome(record)} />

      <Layer
        render={<dl />}
        className="grid gap-y-1 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:items-start sm:gap-x-3 sm:gap-y-2.5"
      >
        <Field label="Adds">
          <SemanticText
            as="p"
            className="text-ink-800"
            role="row-value"
            text={feature.description}
            variant="compact"
            wrapAuthority="native-browser"
          />
        </Field>
        <Field label="Why">
          <SemanticText
            as="p"
            className="text-ink-600"
            role="row-value"
            text={feature.rationale}
            variant="compact"
            wrapAuthority="native-browser"
          />
        </Field>
        <NoteField build={build} role={role} />
      </Layer>

      <Cluster render={<footer />} className="items-center gap-x-3 gap-y-1">
        {Option.match(record, {
          onNone: () => (
            <>
              <StatusMarkPending label={signatureLabelShape} tone={neutralStatusTone} />
              <ContentIdPending form="short" />
            </>
          ),
          onSome: (value) => (
            <>
              <StatusMark
                label={signatureLabel(value.signature)}
                mark={{ _tag: "Signature", subject: value.contentId }}
                tone={signatureTone(value.signature.valid)}
              />
              <ContentId form="short" id={value.contentId} />
            </>
          )
        })}
      </Cluster>
    </Stack>
  )
}
