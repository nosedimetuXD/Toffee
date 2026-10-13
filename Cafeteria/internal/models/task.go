package models

import (
	"time"

	"github.com/google/uuid"
)

type TaskStatus string

const (
	TaskPending    TaskStatus = "pending"
	TaskInProgress TaskStatus = "in_progress"
	TaskDone       TaskStatus = "done"
)

type Task struct {
	ID             uuid.UUID  `json:"id"`
	Title          string     `json:"title"`
	Description    string     `json:"description,omitempty"`
	AssignedTo     *uuid.UUID `json:"assigned_to,omitempty"`
	AssignedToName string     `json:"assigned_to_name,omitempty"`
	CreatedBy      uuid.UUID  `json:"created_by"`
	CreatedByName  string     `json:"created_by_name,omitempty"`
	Status         TaskStatus `json:"status"`
	DueDate        *time.Time `json:"due_date,omitempty"`
	IsDaily        bool       `json:"is_daily"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
