"""Calculus domain fixture generation with explicit provenance classes.

SciPy/NumPy-derived expectations:
- ``trapezoid`` via ``numpy.trapz``
- ``simpson`` via ``scipy.integrate.simpson``
- ``adaptiveSimpson`` via ``scipy.integrate.quad``

Analytic/reference-derived expectations:
- ``derivative`` and ``secondDerivative`` (closed-form / reference formulas)
- multivariate operators (gradient, jacobian, hessian, directionalDerivative,
  divergence, laplacian) from analytic expressions for the fixture functions

This split is intentional: SciPy does not expose one-to-one APIs for every
operator contract we verify.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from scipy import integrate

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "calculus.numerical-parity",
            "file": "calculus/numerical-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    # --- derivative (analytic/reference finite-difference expectation) ---
                    _derivative_case("deriv-x-squared-at-1", "x_squared", 1.0),
                    _derivative_case("deriv-x-squared-at-3", "x_squared", 3.0),
                    _derivative_case("deriv-x-cubed-at-2", "x_cubed", 2.0),
                    _derivative_case("deriv-sin-at-0", "sin", 0.0),
                    _derivative_case("deriv-sin-at-pi-half", "sin", math.pi / 2),
                    _derivative_case("deriv-exp-at-0", "exp", 0.0),
                    _derivative_case("deriv-exp-at-1", "exp", 1.0),
                    _derivative_case("deriv-ln-at-1", "ln", 1.0),
                    _derivative_case("deriv-ln-at-2", "ln", 2.0),
                    _derivative_case("deriv-cubic-plus-linear-at-2", "cubic_plus_linear", 2.0),
                    # --- second derivative (analytic/reference expectation) ---
                    _second_derivative_case("second-deriv-x-cubed-at-2", "x_cubed", 2.0),
                    _second_derivative_case("second-deriv-sin-at-pi-third", "sin", math.pi / 3),
                    _second_derivative_case("second-deriv-exp-at-1", "exp", 1.0),
                    _second_derivative_case("second-deriv-cubic-plus-linear-at-1", "cubic_plus_linear", 1.0),
                    # --- trapezoid (SciPy/NumPy reference) ---
                    _trapezoid_case("trap-constant", [1.0, 1.0, 1.0, 1.0, 1.0], 0.25),
                    _trapezoid_case("trap-linear", [0.0, 1.0, 2.0, 3.0, 4.0], 1.0),
                    _trapezoid_case("trap-quadratic-5", [0.0, 1.0, 4.0, 9.0, 16.0], 1.0),
                    _trapezoid_case("trap-sine-quarter",
                                    [math.sin(i * math.pi / 20) for i in range(11)],
                                    math.pi / 20),
                    _trapezoid_case("trap-uniform-dx",
                                    [1.0, 4.0, 9.0, 16.0, 25.0], 0.5),
                    # --- simpson (SciPy reference) ---
                    _simpson_case("simpson-constant", [2.0, 2.0, 2.0, 2.0, 2.0], 1.0),
                    _simpson_case("simpson-linear", [0.0, 1.0, 2.0, 3.0, 4.0], 1.0),
                    _simpson_case("simpson-quadratic", [0.0, 1.0, 4.0, 9.0, 16.0], 1.0),
                    _simpson_case("simpson-sine",
                                  [math.sin(i * math.pi / 20) for i in range(11)],
                                  math.pi / 20),
                    _simpson_case("simpson-cubic",
                                  [float(x**3) for x in range(5)], 1.0),
                    # --- adaptive Simpson over continuous functions (SciPy reference) ---
                    _adaptive_simpson_case("adaptive-simpson-sine", "sin", 0.0, math.pi, 1e-8, 1e-8, 12),
                    _adaptive_simpson_case("adaptive-simpson-exp", "exp", 0.0, 1.0, 1e-8, 1e-8, 12),
                    # --- multivariate differential operators (analytic/reference) ---
                    _gradient_case("gradient-quadratic-surface-point-a", "quadratic_surface", [1.0, 2.0]),
                    _gradient_case("gradient-quadratic-surface-point-b", "quadratic_surface", [-0.5, 0.25]),
                    _jacobian_case("jacobian-coupled-field-point-a", "coupled_field", [1.0, 2.0]),
                    _jacobian_case("jacobian-coupled-field-point-b", "coupled_field", [-0.5, 0.25]),
                    _hessian_case("hessian-quadratic-surface-point-a", "quadratic_surface", [1.0, 2.0]),
                    _hessian_case("hessian-quadratic-surface-point-b", "quadratic_surface", [-0.5, 0.25]),
                    _directional_derivative_case(
                        "directional-quadratic-surface-point-a",
                        "quadratic_surface",
                        [1.0, 2.0],
                        [1.0, 1.0],
                    ),
                    _directional_derivative_case(
                        "directional-quadratic-surface-point-b",
                        "quadratic_surface",
                        [-0.5, 0.25],
                        [2.0, -1.0],
                    ),
                    _divergence_case("divergence-coupled-field-point-a", "coupled_field", [1.0, 2.0]),
                    _divergence_case("divergence-coupled-field-point-b", "coupled_field", [-0.5, 0.25]),
                    _laplacian_case("laplacian-quadratic-surface-point-a", "quadratic_surface", [1.0, 2.0]),
                    _laplacian_case("laplacian-quadratic-surface-point-b", "quadratic_surface", [-0.5, 0.25]),
                ]
            },
        }
        ,
        {
            "fixture": "calculus.ode-parity",
            "file": "calculus/ode-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    _fixed_ode_case(
                        case_id="ode-euler-decay",
                        function_name="exponential_decay",
                        final_time=1.0,
                        initial_state=[1.0],
                        operation="solveEuler",
                        step_size=0.1,
                    ),
                    _fixed_ode_case(
                        case_id="ode-rk4-decay",
                        function_name="exponential_decay",
                        final_time=1.0,
                        initial_state=[1.0],
                        operation="solveRk4",
                        step_size=0.1,
                    ),
                    _fixed_ode_case(
                        case_id="ode-euler-harmonic",
                        function_name="harmonic_oscillator",
                        final_time=1.0,
                        initial_state=[1.0, 0.0],
                        operation="solveEuler",
                        step_size=0.05,
                    ),
                    _fixed_ode_case(
                        case_id="ode-rk4-harmonic",
                        function_name="harmonic_oscillator",
                        final_time=1.0,
                        initial_state=[1.0, 0.0],
                        operation="solveRk4",
                        step_size=0.05,
                    ),
                    _adaptive_ode_case(
                        case_id="ode-rk45-decay",
                        function_name="exponential_decay",
                        final_time=1.0,
                        initial_state=[1.0],
                        initial_step=0.1,
                        max_step=0.2,
                        absolute_tolerance=1e-8,
                        relative_tolerance=1e-8,
                    ),
                    _adaptive_ode_case(
                        case_id="ode-rk45-harmonic",
                        function_name="harmonic_oscillator",
                        final_time=1.0,
                        initial_state=[1.0, 0.0],
                        initial_step=0.05,
                        max_step=0.1,
                        absolute_tolerance=1e-8,
                        relative_tolerance=1e-8,
                    ),
                ]
            },
        }
    ]


_FUNCTIONS = {
    "x_squared": lambda x: x**2,
    "x_cubed": lambda x: x**3,
    "sin": math.sin,
    "exp": math.exp,
    "ln": math.log,
    "cubic_plus_linear": lambda x: x**3 + 2.0 * x,
}


def _exponential_decay(_time: float, state: np.ndarray) -> np.ndarray:
    return np.array([-state[0]], dtype=float)


def _harmonic_oscillator(_time: float, state: np.ndarray) -> np.ndarray:
    return np.array([state[1], -state[0]], dtype=float)


_ODE_FUNCTIONS = {
    "exponential_decay": _exponential_decay,
    "harmonic_oscillator": _harmonic_oscillator,
}

_SECOND_DERIVATIVES = {
    "x_cubed": lambda x: 6.0 * x,
    "sin": lambda x: -math.sin(x),
    "exp": math.exp,
    "cubic_plus_linear": lambda x: 6.0 * x,
}

_DEFAULT_ABSOLUTE_TOLERANCE = 1e-8
_DEFAULT_RELATIVE_TOLERANCE = 2e-8


def _assertion(
    absolute_tolerance: float = _DEFAULT_ABSOLUTE_TOLERANCE,
    relative_tolerance: float = _DEFAULT_RELATIVE_TOLERANCE,
) -> dict[str, float]:
    return {
        "absoluteTolerance": absolute_tolerance,
        "relativeTolerance": relative_tolerance,
    }


def _trajectory_points(times: list[float], values: np.ndarray) -> list[dict[str, Any]]:
    return [
        {
            "time": float(time),
            "state": [float(component) for component in values[:, index].tolist()],
        }
        for index, time in enumerate(times)
    ]


def _fixed_ode_case(
    case_id: str,
    function_name: str,
    final_time: float,
    initial_state: list[float],
    operation: str,
    step_size: float,
) -> dict[str, Any]:
    rhs = _ODE_FUNCTIONS[function_name]
    sample_count = int(round(final_time / step_size))
    times = np.linspace(0.0, final_time, sample_count + 1)
    reference = integrate.solve_ivp(
        rhs,
        (0.0, final_time),
        np.array(initial_state, dtype=float),
        method="RK45",
        t_eval=times,
        rtol=1e-12,
        atol=1e-12,
    )

    return {
        "id": case_id,
        "operation": operation,
        "input": {
            "function": function_name,
            "initialTime": 0.0,
            "finalTime": final_time,
            "initialState": initial_state,
            "stepSize": step_size,
        },
        "expected": {
            "status": "finished",
            "finalState": [float(component) for component in reference.y[:, -1].tolist()],
            "trajectory": _trajectory_points(reference.t.tolist(), reference.y),
        },
        "assertion": _assertion(5e-2 if operation == "solveEuler" else 1e-8, 5e-2 if operation == "solveEuler" else 1e-8),
    }


def _adaptive_ode_case(
    case_id: str,
    function_name: str,
    final_time: float,
    initial_state: list[float],
    initial_step: float,
    max_step: float,
    absolute_tolerance: float,
    relative_tolerance: float,
) -> dict[str, Any]:
    rhs = _ODE_FUNCTIONS[function_name]
    solver = integrate.RK45(
        rhs,
        0.0,
        np.array(initial_state, dtype=float),
        final_time,
        first_step=initial_step,
        max_step=max_step,
        atol=absolute_tolerance,
        rtol=relative_tolerance,
    )

    times = [0.0]
    states = [np.array(initial_state, dtype=float)]

    while solver.status == "running":
        solver.step()
        times.append(float(solver.t))
        states.append(np.array(solver.y, dtype=float))

    stacked = np.stack(states, axis=1)

    return {
        "id": case_id,
        "operation": "solveAdaptiveRk45",
        "input": {
            "function": function_name,
            "initialTime": 0.0,
            "finalTime": final_time,
            "initialState": initial_state,
            "initialStep": initial_step,
            "maxStep": max_step,
            "absoluteTolerance": absolute_tolerance,
            "relativeTolerance": relative_tolerance,
        },
        "expected": {
            "status": "finished",
            "finalState": [float(component) for component in stacked[:, -1].tolist()],
            "trajectory": _trajectory_points(times, stacked),
        },
        "assertion": _assertion(1e-8, 1e-8),
    }


def _central_difference(f, x: float, h: float = 1e-8) -> float:
    """Central finite difference approximation of f'(x)."""
    return (f(x + h) - f(x - h)) / (2 * h)


def _derivative_case(case_id: str, func_name: str, x: float) -> dict[str, Any]:
    f = _FUNCTIONS[func_name]
    result = float(_central_difference(f, x))
    return {
        "id": case_id,
        "operation": "derivative",
        "input": {"function": func_name, "x": x},
        "expected": result,
        "assertion": _assertion(),
    }


def _second_derivative_case(case_id: str, func_name: str, x: float) -> dict[str, Any]:
    f2 = _SECOND_DERIVATIVES[func_name]
    result = float(f2(x))
    return {
        "id": case_id,
        "operation": "secondDerivative",
        "input": {"function": func_name, "x": x},
        "expected": result,
        "assertion": _assertion(),
    }


def _trapezoid_case(case_id: str, values: list[float], dx: float) -> dict[str, Any]:
    result = float(np.trapz(np.array(values), dx=dx))
    return {
        "id": case_id,
        "operation": "trapezoid",
        "input": {"values": values, "dx": dx},
        "expected": result,
        "assertion": _assertion(),
    }


def _simpson_case(case_id: str, values: list[float], dx: float) -> dict[str, Any]:
    result = float(integrate.simpson(np.array(values), dx=dx))
    return {
        "id": case_id,
        "operation": "simpson",
        "input": {"values": values, "dx": dx},
        "expected": result,
        "assertion": _assertion(),
    }


def _adaptive_simpson_case(
    case_id: str,
    func_name: str,
    a: float,
    b: float,
    absolute_tolerance: float,
    relative_tolerance: float,
    max_depth: int,
) -> dict[str, Any]:
    f = _FUNCTIONS[func_name]
    result = float(integrate.quad(f, a, b, epsabs=absolute_tolerance, epsrel=relative_tolerance)[0])
    return {
        "id": case_id,
        "operation": "adaptiveSimpson",
        "input": {
            "function": func_name,
            "a": a,
            "b": b,
            "absoluteTolerance": absolute_tolerance,
            "relativeTolerance": relative_tolerance,
            "maxDepth": max_depth,
        },
        "expected": result,
        "assertion": _assertion(absolute_tolerance, relative_tolerance),
    }


def _gradient_quadratic_surface(point: list[float]) -> list[float]:
    x, y = point
    return [2.0 * x + 3.0 * y, 3.0 * x + 2.0 * y]


def _jacobian_coupled_field(point: list[float]) -> list[list[float]]:
    x, y = point
    return [[2.0 * x, 1.0], [y + math.cos(x), x]]


def _hessian_quadratic_surface(_point: list[float]) -> list[list[float]]:
    return [[2.0, 3.0], [3.0, 2.0]]


def _directional_derivative_quadratic_surface(point: list[float], direction: list[float]) -> float:
    gradient = _gradient_quadratic_surface(point)
    direction_norm = math.sqrt(sum(component * component for component in direction))
    if direction_norm <= 0:
        raise ValueError("direction vector norm must be positive")
    dot = sum(gradient_component * direction_component for gradient_component, direction_component in zip(gradient, direction))
    return float(dot / direction_norm)


def _divergence_coupled_field(point: list[float]) -> float:
    x, _ = point
    return float(3.0 * x)


def _laplacian_quadratic_surface(_point: list[float]) -> float:
    return 4.0


def _gradient_case(case_id: str, func_name: str, point: list[float]) -> dict[str, Any]:
    if func_name != "quadratic_surface":
        raise ValueError(f"unsupported scalar surface: {func_name}")

    return {
        "id": case_id,
        "operation": "gradient",
        "input": {"function": func_name, "point": point},
        "expected": _gradient_quadratic_surface(point),
        "assertion": _assertion(),
    }


def _jacobian_case(case_id: str, func_name: str, point: list[float]) -> dict[str, Any]:
    if func_name != "coupled_field":
        raise ValueError(f"unsupported vector field: {func_name}")

    return {
        "id": case_id,
        "operation": "jacobian",
        "input": {"function": func_name, "point": point},
        "expected": _jacobian_coupled_field(point),
        "assertion": _assertion(),
    }


def _hessian_case(case_id: str, func_name: str, point: list[float]) -> dict[str, Any]:
    if func_name != "quadratic_surface":
        raise ValueError(f"unsupported scalar surface: {func_name}")

    return {
        "id": case_id,
        "operation": "hessian",
        "input": {"function": func_name, "point": point},
        "expected": _hessian_quadratic_surface(point),
        "assertion": _assertion(),
    }


def _directional_derivative_case(
    case_id: str,
    func_name: str,
    point: list[float],
    direction: list[float],
) -> dict[str, Any]:
    if func_name != "quadratic_surface":
        raise ValueError(f"unsupported scalar surface: {func_name}")

    return {
        "id": case_id,
        "operation": "directionalDerivative",
        "input": {"function": func_name, "point": point, "direction": direction},
        "expected": _directional_derivative_quadratic_surface(point, direction),
        "assertion": _assertion(),
    }


def _divergence_case(case_id: str, func_name: str, point: list[float]) -> dict[str, Any]:
    if func_name != "coupled_field":
        raise ValueError(f"unsupported vector field: {func_name}")

    return {
        "id": case_id,
        "operation": "divergence",
        "input": {"function": func_name, "point": point},
        "expected": _divergence_coupled_field(point),
        "assertion": _assertion(),
    }


def _laplacian_case(case_id: str, func_name: str, point: list[float]) -> dict[str, Any]:
    if func_name != "quadratic_surface":
        raise ValueError(f"unsupported scalar surface: {func_name}")

    return {
        "id": case_id,
        "operation": "laplacian",
        "input": {"function": func_name, "point": point},
        "expected": _laplacian_quadratic_surface(point),
        "assertion": _assertion(),
    }
