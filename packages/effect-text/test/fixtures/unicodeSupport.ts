export const unicodeSegmentationFixtures = [
  {
    expectedBreakKinds: [
      "text",
      "glue",
      "text",
      "space",
      "text",
      "glue",
      "text",
      "space",
      "text",
      "zero-width-break",
      "text"
    ],
    expectedSegments: ["no", "\u00a0", "break", " ", "word", "\u2060", "join", " ", "a", "\u200b", "b"],
    name: "nbsp-wj-zwsp",
    text: "no\u00a0break word\u2060join a\u200bb",
    whiteSpace: "normal"
  },
  {
    expectedBreakKinds: ["text"],
    expectedSegments: ["https://example.com/a-b?x=1,2"],
    name: "url-like-run",
    text: "https://example.com/a-b?x=1,2",
    whiteSpace: "normal"
  },
  {
    expectedBreakKinds: ["text"],
    expectedSegments: ["1,234.56"],
    name: "numeric-run",
    text: "1,234.56",
    whiteSpace: "normal"
  },
  {
    expectedBreakKinds: ["text", "space", "text"],
    expectedSegments: ["(hello)", " ", "[world]"],
    name: "opening-and-closing-punctuation",
    text: "(hello) [world]",
    whiteSpace: "normal"
  },
  {
    expectedBreakKinds: ["text", "space", "text"],
    expectedSegments: ["\u300c\u4f60\u597d\u300d", " ", "\u300e\u4e16\u754c\u300f"],
    name: "cjk-punctuation-pairs",
    text: "\u300c\u4f60\u597d\u300d \u300e\u4e16\u754c\u300f",
    whiteSpace: "normal"
  }
] as const

export const unicodeOverflowFixtures = [
  {
    maxWidth: 25,
    name: "url-like-run",
    text: "https://example.com/a-b?x=1,2"
  },
  {
    maxWidth: 20,
    name: "numeric-run",
    text: "1,234.56"
  },
  {
    maxWidth: 25,
    name: "opening-and-closing-punctuation",
    text: "(hello) [world]"
  },
  {
    maxWidth: 20,
    name: "cjk-punctuation-pairs",
    text: "\u300c\u4f60\u597d\u300d \u300e\u4e16\u754c\u300f"
  }
] as const
