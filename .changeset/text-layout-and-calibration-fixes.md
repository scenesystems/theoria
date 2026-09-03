---
"@scenesystems/effect-text": patch
---

- Line layout stops when the cursor reaches the end of the prepared segments instead of asking the line walker for a record past the input.
- `Calibration` report totals sum the per-case losses directly instead of multiplying the mean by the count.
- The browser support manifest caveats describe the synthetic regression context instead of claiming browser parity; the live harness is now `examples/live/syntheticRegressionHarness.ts` (`verify:synthetic-regression`).
