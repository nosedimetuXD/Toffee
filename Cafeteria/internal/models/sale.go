package models

import (
	"time"

	"github.com/google/uuid"
)

type SaleItem struct {
	ID                  uuid.UUID  `json:"id"`
	SaleID              uuid.UUID  `json:"sale_id"`
	ProductID           uuid.UUID  `json:"product_id"`
	ProductName         string     `json:"product_name"`
	Quantity            int        `json:"quantity"`
	UnitPrice           float64    `json:"unit_price"`
	Notes               string     `json:"notes,omitempty"`
	RequiresPreparation bool       `json:"requires_preparation"`
	CreatedAt           time.Time  `json:"created_at"`
}

type Sale struct {
	ID                  uuid.UUID  `json:"id"`
	SoldBy              *uuid.UUID `json:"sold_by,omitempty"`
	SoldByUsername      string     `json:"sold_by_name,omitempty"`
	CustomerID          *uuid.UUID `json:"customer_id,omitempty"`
	CustomerName        string     `json:"customer_name"`
	PaymentMethod       string     `json:"payment_method"`
	CashAmount          float64    `json:"cash_amount"`
	TransferAmount      float64    `json:"transfer_amount"`
	BankDetails         string     `json:"bank_details,omitempty"`
	Subtotal            float64    `json:"subtotal"`
	DiscountPercent     float64    `json:"discount_percent"`
	DiscountAmount      float64    `json:"discount_amount"`
	DiscountReason      string     `json:"discount_reason,omitempty"`
	RedeemedCoffees     int        `json:"redeemed_coffees"`
	WelcomeBonusAwarded bool       `json:"welcome_bonus_awarded"`
	Total               float64    `json:"total"`
	PaidAmount          float64    `json:"paid_amount"`
	PendingAmount       float64    `json:"pending_amount"`
	PaymentStatus       string     `json:"payment_status,omitempty"`
	Status              string     `json:"status,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	Items               []SaleItem `json:"items,omitempty"`
}
