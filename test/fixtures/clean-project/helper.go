package main

// Swap returns the two values in reversed order.
func Swap(a int, b int) (int, int) {
	return b, a
}

func TestSwap(t *testing.T) {
	a, b := Swap(1, 2)
	if a != 2 || b != 1 {
		t.Errorf("Swap() = (%v, %v), want (2, 1)", a, b)
	}
}
