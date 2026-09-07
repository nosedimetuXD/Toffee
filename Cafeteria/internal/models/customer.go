package models

import (
	"time"

	"github.com/google/uuid"
)

type Customer struct {
	ID                uuid.UUID  `json:"id"`
	FirstName         string     `json:"first_name"`
	LastName          string     `json:"last_name"`
	Phone             string     `json:"phone"`
	Email             string     `json:"email"`
	Notes             string     `json:"notes"`
	CreatedBy         *uuid.UUID `json:"created_by,omitempty"`
	CreatedByUsername string     `json:"created_by_username"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	TotalSpent        float64    `json:"total_spent"`
	TotalOrders       int        `json:"total_orders"`
	TotalDebt         float64    `json:"total_debt"`
	LastOrderDate     *time.Time `json:"last_order_date,omitempty"`
}

type CustomerPayment struct {
	ID             uuid.UUID  `json:"id"`
	CustomerID     uuid.UUID  `json:"customer_id"`
	Amount         float64    `json:"amount"`
	PaymentMethod  string     `json:"payment_method"`
	BankDetails    string     `json:"bank_details,omitempty"`
	Notes          string     `json:"notes,omitempty"`
	RegisteredBy   *uuid.UUID `json:"registered_by,omitempty"`
	RegisteredName string     `json:"registered_name,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type CustomerAccountSummary struct {
	Customer       Customer          `json:"customer"`
	TotalSales     float64           `json:"total_sales"`
	TotalPaid      float64           `json:"total_paid"`
	CurrentDebt    float64           `json:"current_debt"`
	PendingSales   []Sale            `json:"pending_sales"`
	PaymentHistory []CustomerPayment `json:"payment_history"`
}
