---
"@scenesystems/effect-text": minor
---

`renderBrowserParityArtifact` fails in the typed error channel. A profile that does not declare every released synthetic scenario fails with the new `BrowserParityCasesMissing`, naming the profile and the scenarios it omits, and a scenario whose text cannot be measured fails with that measurement's `MeasurementFailed`. Previously both were defects.
