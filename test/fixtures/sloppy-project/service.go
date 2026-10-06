package service

import "math"

// Calc exposes the math operations used by the reporting jobs.

// TODO: validate inputs before mutating state
// TODO: add unit tests for edge cases
// TODO: document the rounding behavior
// TODO: wire this into the config layer
// TODO: remove the legacy code path
// TODO: measure before optimizing

func Calc(values []float64, mode string) float64 {
	// TODO: support more modes
	if mode == "sum" {
		total := 0.0
		for _, v := range values {
			total += v
		}
		return total
	}
	if mode == "sqrt" && len(values) > 0 {
		return math.Sqrt(values[0])
	}
	panic("not implemented")
}

func TestCalc(t *testing.T) {
	got := Calc([]float64{1, 2, 3}, "sum")
	_ = got
}
