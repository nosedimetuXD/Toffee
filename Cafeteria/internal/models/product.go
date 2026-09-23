package models

import (
	"time"

	"github.com/google/uuid"
)

type Product struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Price       float64   `json:"price"`
	Category    string    `json:"category,omitempty"`
	ImageURL            string    `json:"image_url,omitempty"`
	RequiresPreparation bool      `json:"requires_preparation"`
	Active              bool      `json:"active"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}
