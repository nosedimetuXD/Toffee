package handlers

import "testing"

func TestCalculateLoyalty(t *testing.T) {
	// AC1: Regular user accumulating coffees
	// 0 coffees -> 0 free, 0 progress
	free, prog := CalculateLoyalty(0, 0, 0)
	if free != 0 || prog != 0 {
		t.Errorf("expected (0, 0), got (%d, %d)", free, prog)
	}

	// 5 coffees -> 0 free, 5 progress
	free, prog = CalculateLoyalty(5, 0, 0)
	if free != 0 || prog != 5 {
		t.Errorf("expected (0, 5), got (%d, %d)", free, prog)
	}

	// 6 coffees -> 1 free (reward unlocked), 6 progress (card full)
	free, prog = CalculateLoyalty(6, 0, 0)
	if free != 1 || prog != 6 {
		t.Errorf("expected (1, 6), got (%d, %d)", free, prog)
	}

	// When user redeems free coffee -> 0 free, 0 progress (reset to 0!)
	free, prog = CalculateLoyalty(6, 0, 1)
	if free != 0 || prog != 0 {
		t.Errorf("expected (0, 0), got (%d, %d) after redemption", free, prog)
	}

	// User buys 1 more coffee after redemption -> 0 free, 1 progress
	free, prog = CalculateLoyalty(7, 0, 1)
	if free != 0 || prog != 1 {
		t.Errorf("expected (0, 1), got (%d, %d)", free, prog)
	}

	// AC2: Onboarding welcome bonus (+2 points on first coffee)
	// New user buys 1 coffee with 2 bonus coffees -> 3 points total -> 0 free, 3 progress (3/6)
	free, prog = CalculateLoyalty(1, 2, 0)
	if free != 0 || prog != 3 {
		t.Errorf("expected (0, 3), got (%d, %d) for welcome bonus", free, prog)
	}

	// User buys 3 more coffees -> 4 coffees + 2 bonus = 6 points -> 1 free, 6 progress
	free, prog = CalculateLoyalty(4, 2, 0)
	if free != 1 || prog != 6 {
		t.Errorf("expected (1, 6), got (%d, %d)", free, prog)
	}

	// User redeems the reward -> 0 free, 0 progress (cycle resets to 0)
	free, prog = CalculateLoyalty(4, 2, 1)
	if free != 0 || prog != 0 {
		t.Errorf("expected (0, 0), got (%d, %d) after redeeming welcome reward", free, prog)
	}

	// AC3: Existing user with >= 6 coffees at deployment
	// 8 coffees, 0 redeemed -> 1 free, 6 progress
	free, prog = CalculateLoyalty(8, 0, 0)
	if free != 1 || prog != 6 {
		t.Errorf("expected (1, 6), got (%d, %d) for existing user with 8 coffees", free, prog)
	}

	// Existing user redeems reward -> 0 free, 2 progress in next cycle (8 - 6 = 2)
	free, prog = CalculateLoyalty(8, 0, 1)
	if free != 0 || prog != 2 {
		t.Errorf("expected (0, 2), got (%d, %d)", free, prog)
	}
}
