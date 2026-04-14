import { describe, expect, it } from "@effect/vitest"
import {
  PackageDocsRichTextDocument,
  PackageDocsRichTextElementNode,
  PackageDocsRichTextTextNode
} from "@theoria/source-proof/contracts"
import { createRoot } from "react-dom/client"

import { PackageDocsMarkdownBody } from "../../app/web/view/docs/PackageDocsMarkdown.js"

const textNode = (value: string) => PackageDocsRichTextTextNode.make({ value })

const elementNode = (input: {
  readonly children?: ReadonlyArray<PackageDocsRichTextElementNode | PackageDocsRichTextTextNode>
  readonly properties?: Record<string, string | boolean | ReadonlyArray<string>>
  readonly tagName: string
}) => PackageDocsRichTextElementNode.make({
  children: input.children ?? [],
  properties: input.properties ?? {},
  tagName: input.tagName
})

describe("web/package-docs-markdown", () => {
  it("renders structured package docs content without browser-side markdown compilation", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    const markdownDocument = PackageDocsRichTextDocument.make({
      children: [
        elementNode({
          children: [
            textNode("Digest "),
            elementNode({ children: [textNode("blake3")], tagName: "code" })
          ],
          tagName: "h2"
        }),
        elementNode({
          children: [
            elementNode({
              children: [
                elementNode({ properties: { checked: true, type: "checkbox" }, tagName: "input" }),
                textNode("Verified task")
              ],
              tagName: "li"
            })
          ],
          tagName: "ul"
        }),
        elementNode({
          children: [
            elementNode({
              children: [
                elementNode({
                  children: [
                    elementNode({ children: [textNode("Name")], tagName: "th" }),
                    elementNode({ children: [textNode("Value")], tagName: "th" })
                  ],
                  tagName: "tr"
                })
              ],
              tagName: "thead"
            }),
            elementNode({
              children: [
                elementNode({
                  children: [
                    elementNode({ children: [textNode("digest")], tagName: "td" }),
                    elementNode({
                      children: [elementNode({ children: [textNode("blake3")], tagName: "code" })],
                      tagName: "td"
                    })
                  ],
                  tagName: "tr"
                })
              ],
              tagName: "tbody"
            })
          ],
          tagName: "table"
        }),
        elementNode({
          children: [
            elementNode({
              children: [textNode('{"ok": true}\n')],
              properties: { className: ["language-json"] },
              tagName: "code"
            })
          ],
          tagName: "pre"
        }),
        elementNode({
          children: [textNode("Table of contents")],
          properties: { className: ["text-delta"] },
          tagName: "h2"
        })
      ]
    })

    root.render(
      <PackageDocsMarkdownBody document={markdownDocument} />
    )

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    const headingInlineCode = container.querySelector("h2 code")
    const taskCheckbox = container.querySelector('input[type="checkbox"]')
    const table = container.querySelector("table")
    const htmlHeading = Array.from(container.querySelectorAll("h2")).find(
      (node) => node.textContent === "Table of contents"
    )

    expect(headingInlineCode?.textContent).toBe("blake3")
    expect(taskCheckbox instanceof HTMLInputElement).toBe(true)
    expect(taskCheckbox instanceof HTMLInputElement ? taskCheckbox.checked : false).toBe(true)
    expect(table instanceof HTMLTableElement).toBe(true)
    expect(htmlHeading).toBeDefined()

    root.unmount()
    container.remove()
  })
})
