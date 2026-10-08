"""Shared helpers for fixture family generators."""

from __future__ import annotations

from typing import Any

import numpy as np
import optuna

DEFAULT_GENERATED_AT = "2026-03-15T00:00:00Z"

def metadata(generated_at: str) -> dict[str, Any]:
    """Standard metadata block for every fixture document."""
    return {
        "generatedAt": generated_at,
        "upstream": {
            "name": "optuna",
            "version": optuna.__version__,
        },
        "generator": {
            "script": "scripts/generate-optuna-fixtures.py",
        },
    }


class RecordingRandomState(np.random.RandomState):
    """Observe actual NumPy draws without replacing its selection algorithm."""

    def __init__(self, seed):
        super().__init__(seed)
        self.component_rolls = []
        self.value_rolls = []
        self.categorical_rolls = []

    def choice(self, a, size=None, replace=True, p=None):
        # NumPy's weighted replacement choice draws these uniforms in C.
        # Clone its state to observe them without consuming the live stream.
        shadow = np.random.RandomState()
        shadow.set_state(self.get_state())
        self.component_rolls.extend(shadow.uniform(size=size).reshape(-1).tolist())
        return super().choice(a, size=size, replace=replace, p=p)

    def uniform(self, low=0., high=1., size=None):
        values = super().uniform(low=low, high=high, size=size)
        self.value_rolls.extend(np.asarray(values).reshape(-1).tolist())
        return values

    def rand(self, *size):
        values = super().rand(*size)
        self.categorical_rolls.extend(np.asarray(values).reshape(-1).tolist())
        return values
