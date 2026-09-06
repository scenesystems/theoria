---
"@scenesystems/effect-text": minor
---

`Experimental.Calibration.optimizeProfile` fails in the typed error channel when supplied study storage does not hold the calibration study. Storage that holds no snapshot after the study ran fails with the new `CalibrationSnapshotMissing`, carrying the retained trial-log length, and storage that resolves to a multi-objective study fails with the new `CalibrationStudyNotSingleObjective`. Previously both were defects.
