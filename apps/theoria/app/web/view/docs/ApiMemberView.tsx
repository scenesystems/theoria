import { Boolean as Bool } from "effect"
import * as Arr from "effect/Array"

import type { ApiMember } from "@theoria/docs-model"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { linkTextClassName } from "../primitives/designSystem.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ApiDocumentationView } from "./ApiDocumentationView.js"
import { ApiSignatureView } from "./ApiSignatureView.js"

export const ApiMemberView = ({ member }: { readonly member: ApiMember }) => (
  <Section className="scroll-mt-28 border-l border-hairline-strong-glass pl-4 sm:pl-5" id={member.anchor}>
    <Stack className="gap-5">
      <Cluster className="gap-2">
        <SemanticContent as="h3" role="subsection-title">{member.name}</SemanticContent>
        <SemanticText as="span" role="row-label" text={member.kind} />
        {Bool.match(member.inherited, {
          onTrue: () => <SemanticText as="span" role="row-label" text="inherited" />,
          onFalse: () =>
            null
        })}
      </Cluster>
      {Arr.match(member.signatures, {
        onEmpty: () => (
          <Stack className="gap-4">
            <ApiDocumentationView docs={member.docs} headingAs="h4" />
            <CodeBlock label="Type" source={member.declaration} />
            <ExternalLink
              className={`w-fit text-ink-secondary ${linkTextClassName}`}
              href={member.sourceUrl}
            >
              <SemanticText as="span" role="button-label" text="Source" />
            </ExternalLink>
          </Stack>
        ),
        onNonEmpty: (signatures) => (
          <Stack className="gap-8">
            {Arr.map(
              signatures,
              (signature, index) => (
                <ApiSignatureView
                  headingAs="h4"
                  index={index}
                  key={`${signature.kind}:${String(index)}`}
                  signature={signature}
                  total={Arr.length(signatures)}
                />
              )
            )}
          </Stack>
        )
      })}
    </Stack>
  </Section>
)
