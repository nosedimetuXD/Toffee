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
	LastOrderDate     *time.Time `json:"last_order_date,omitempty"`
}
