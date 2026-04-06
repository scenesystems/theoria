"""FFT domain fixture generation from NumPy reference implementations."""

from __future__ import annotations

from typing import Any

import numpy as np

from ._common import metadata


def _complex_payload(values: np.ndarray) -> dict[str, Any]:
    return {
        "real": [float(np.real(value)) for value in values],
        "imaginary": [float(np.imag(value)) for value in values],
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    fixture_metadata = metadata(generated_at)

    fft_input = np.array([1.0, 2.0, 3.0, 4.0, 5.0], dtype=np.complex128)
    ifft_input = np.fft.fft(fft_input, norm="backward")
    rfft_input = np.array([0.0, 1.0, 0.5, -1.0, 2.0], dtype=np.float64)
    rfft_spectrum = np.fft.rfft(rfft_input, norm="ortho")

    return [
        {
            "fixture": "fft.transform-parity",
            "file": "fft/transform-parity.json",
            "metadata": fixture_metadata,
            "payload": {
                "cases": [
                    {
                        "id": "fft.backward.prime5",
                        "operation": "fft",
                        "input": {
                            "real": [float(value) for value in np.real(fft_input)],
                            "imaginary": [float(value) for value in np.imag(fft_input)],
                            "normalization": "backward",
                        },
                        "expected": _complex_payload(np.fft.fft(fft_input, norm="backward")),
                    },
                    {
                        "id": "ifft.backward.prime5",
                        "operation": "ifft",
                        "input": {
                            "real": [float(np.real(value)) for value in ifft_input],
                            "imaginary": [float(np.imag(value)) for value in ifft_input],
                            "normalization": "backward",
                        },
                        "expected": _complex_payload(np.fft.ifft(ifft_input, norm="backward")),
                    },
                    {
                        "id": "rfft.ortho.prime5",
                        "operation": "rfft",
                        "input": {
                            "values": [float(value) for value in rfft_input],
                            "normalization": "ortho",
                        },
                        "expected": _complex_payload(rfft_spectrum),
                    },
                    {
                        "id": "irfft.ortho.prime5",
                        "operation": "irfft",
                        "input": {
                            "signalLength": 5,
                            "real": [float(np.real(value)) for value in rfft_spectrum],
                            "imaginary": [float(np.imag(value)) for value in rfft_spectrum],
                            "normalization": "ortho",
                        },
                        "expected": [float(value) for value in np.fft.irfft(rfft_spectrum, n=5, norm="ortho")],
                    },
                ]
            },
        }
    ]
