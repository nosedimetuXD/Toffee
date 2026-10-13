package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NosedimetuXD/cafeteria/internal/events"
	custommw "github.com/NosedimetuXD/cafeteria/internal/middleware"
	"github.com/NosedimetuXD/cafeteria/internal/models"
)

type TaskHandler struct {
	DB  *pgxpool.Pool
	Hub *events.Hub
}

func NewTaskHandler(db *pgxpool.Pool, hub *events.Hub) *TaskHandler {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, _ = db.Exec(ctx, `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_daily BOOLEAN DEFAULT false;`)

	return &TaskHandler{DB: db, Hub: hub}
}

// GET /tasks — empleados solo ven tareas asignadas a ellos; dueños y admins ven todas
func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	roleVal := ctx.Value(custommw.ContextRole)
	userVal := ctx.Value(custommw.ContextUserID)

	userRole := ""
	if roleVal != nil {
		userRole = strings.ToLower(fmt.Sprintf("%v", roleVal))
	}

	var currentUserID *uuid.UUID
	if userVal != nil {
		if uid, ok := userVal.(uuid.UUID); ok {
			currentUserID = &uid
		} else if uidStr, ok := userVal.(string); ok {
			if parsed, err := uuid.Parse(uidStr); err == nil {
				currentUserID = &parsed
			}
		}
	}

	// Reiniciar estado de tareas diarias completadas en días anteriores (a la medianoche)
	_, _ = h.DB.Exec(ctx, `
		UPDATE tasks
		SET status = 'pending', updated_at = now()
		WHERE is_daily = true 
		  AND status IN ('done', 'completed')
		  AND (updated_at AT TIME ZONE 'America/Bogota')::date < (now() AT TIME ZONE 'America/Bogota')::date
	`)

	var rows pgx.Rows
	var err error

	isOwnerOrAdmin := userRole == "owner" || userRole == "dueño" || userRole == "admin" || userRole == "administrador"
	if !isOwnerOrAdmin && currentUserID != nil {
		rows, err = h.DB.Query(ctx,
			`SELECT t.id, t.title, COALESCE(t.description, ''), t.assigned_to, COALESCE(ua.username, ''), 
			        t.created_by, COALESCE(uc.username, 'Admin'), t.status, t.due_date, COALESCE(t.is_daily, false), t.created_at, t.updated_at
			 FROM tasks t
			 LEFT JOIN users ua ON t.assigned_to = ua.id
			 LEFT JOIN users uc ON t.created_by = uc.id
			 WHERE t.assigned_to = $1
			 ORDER BY t.due_date NULLS LAST, t.created_at DESC`, *currentUserID)
	} else {
		rows, err = h.DB.Query(ctx,
			`SELECT t.id, t.title, COALESCE(t.description, ''), t.assigned_to, COALESCE(ua.username, ''), 
			        t.created_by, COALESCE(uc.username, 'Admin'), t.status, t.due_date, COALESCE(t.is_daily, false), t.created_at, t.updated_at
			 FROM tasks t
			 LEFT JOIN users ua ON t.assigned_to = ua.id
			 LEFT JOIN users uc ON t.created_by = uc.id
			 ORDER BY t.due_date NULLS LAST, t.created_at DESC`)
	}

	if err != nil {
		log.Printf("error consultando tareas: %v", err)
		http.Error(w, "error consultando tareas", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var tasks []models.Task
	for rows.Next() {
		var t models.Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.AssignedTo, &t.AssignedToName, &t.CreatedBy, &t.CreatedByName, &t.Status, &t.DueDate, &t.IsDaily, &t.CreatedAt, &t.UpdatedAt); err != nil {
			log.Printf("error leyendo tareas: %v", err)
			http.Error(w, "error leyendo tareas", http.StatusInternalServerError)
			return
		}
		tasks = append(tasks, t)
	}

	if tasks == nil {
		tasks = []models.Task{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

// POST /tasks — solo owner y admin
type createTaskRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	AssignedTo  *uuid.UUID `json:"assigned_to"`
	DueDate     *string    `json:"due_date"` // formato "2026-08-20"
	IsDaily     bool       `json:"is_daily"`
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}
	if req.Title == "" {
		http.Error(w, "el título es obligatorio", http.StatusBadRequest)
		return
	}

	createdBy := r.Context().Value(custommw.ContextUserID)

	var t models.Task
	err := h.DB.QueryRow(r.Context(),
		`INSERT INTO tasks (title, description, assigned_to, created_by, due_date, is_daily)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, title, description, assigned_to, created_by, status, due_date, is_daily, created_at, updated_at`,
		req.Title, req.Description, req.AssignedTo, createdBy, req.DueDate, req.IsDaily,
	).Scan(&t.ID, &t.Title, &t.Description, &t.AssignedTo, &t.CreatedBy, &t.Status, &t.DueDate, &t.IsDaily, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		log.Printf("error creando tarea: %v", err)
		http.Error(w, "error creando tarea", http.StatusInternalServerError)
		return
	}

	if h.Hub != nil {
		h.Hub.Publish("task_created", t)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

// PUT /tasks/{id} — editar título/descripción/asignación/diaria: solo owner y admin
type updateTaskRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	AssignedTo  *uuid.UUID `json:"assigned_to"`
	DueDate     *string    `json:"due_date"`
	IsDaily     bool       `json:"is_daily"`
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var req updateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}
	if req.Title == "" {
		http.Error(w, "el título es obligatorio", http.StatusBadRequest)
		return
	}

	var t models.Task
	err = h.DB.QueryRow(r.Context(),
		`UPDATE tasks
		 SET title = $1, description = $2, assigned_to = $3, due_date = $4, is_daily = $5, updated_at = now()
		 WHERE id = $6
		 RETURNING id, title, description, assigned_to, created_by, status, due_date, is_daily, created_at, updated_at`,
		req.Title, req.Description, req.AssignedTo, req.DueDate, req.IsDaily, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.AssignedTo, &t.CreatedBy, &t.Status, &t.DueDate, &t.IsDaily, &t.CreatedAt, &t.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "tarea no encontrada", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("error actualizando tarea: %v", err)
		http.Error(w, "error actualizando tarea", http.StatusInternalServerError)
		return
	}

	if h.Hub != nil {
		h.Hub.Publish("task_status_updated", t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

// PATCH /tasks/{id}/status — cambio de estado con validación de asignado
type updateStatusRequest struct {
	Status models.TaskStatus `json:"status"`
}

func (h *TaskHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var req updateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}

	statusStr := string(req.Status)
	if statusStr == "completed" {
		req.Status = models.TaskDone
	}

	switch req.Status {
	case models.TaskPending, models.TaskInProgress, models.TaskDone:
		// válido
	default:
		http.Error(w, "estado inválido", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var currentTask models.Task
	err = h.DB.QueryRow(ctx, `SELECT id, assigned_to, created_by, status FROM tasks WHERE id = $1`, id).Scan(&currentTask.ID, &currentTask.AssignedTo, &currentTask.CreatedBy, &currentTask.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "tarea no encontrada", http.StatusNotFound)
		return
	}

	userVal := ctx.Value(custommw.ContextUserID)
	roleVal := ctx.Value(custommw.ContextRole)

	var currentUserID uuid.UUID
	if userVal != nil {
		if val, ok := userVal.(uuid.UUID); ok {
			currentUserID = val
		} else if valStr, ok := userVal.(string); ok {
			currentUserID, _ = uuid.Parse(valStr)
		}
	}

	userRole := ""
	if roleVal != nil {
		userRole = fmt.Sprintf("%v", roleVal)
	}

	if currentTask.AssignedTo != nil && *currentTask.AssignedTo != currentUserID && userRole != "owner" && userRole != "admin" && currentTask.CreatedBy != currentUserID {
		http.Error(w, "Solo el usuario asignado o un administrador pueden modificar el estado de esta tarea", http.StatusForbidden)
		return
	}

	var t models.Task
	err = h.DB.QueryRow(ctx,
		`UPDATE tasks SET status = $1 WHERE id = $2
		 RETURNING id, title, description, assigned_to, created_by, status, due_date, created_at, updated_at`,
		req.Status, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.AssignedTo, &t.CreatedBy, &t.Status, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "tarea no encontrada", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("error actualizando estado: %v", err)
		http.Error(w, "error actualizando estado", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

// DELETE /tasks/{id} — exclusivo para dueños (Owner)
func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	roleVal := r.Context().Value(custommw.ContextRole)
	userRole := ""
	if roleVal != nil {
		userRole = strings.ToLower(fmt.Sprintf("%v", roleVal))
	}
	if userRole != "owner" && userRole != "dueño" {
		http.Error(w, "solo los dueños pueden eliminar tareas", http.StatusForbidden)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	tag, err := h.DB.Exec(r.Context(), `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		log.Printf("error borrando tarea: %v", err)
		http.Error(w, "error borrando tarea", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "tarea no encontrada", http.StatusNotFound)
		return
	}

	if h.Hub != nil {
		h.Hub.Publish("task_deleted", map[string]string{"id": id.String()})
	}

	w.WriteHeader(http.StatusNoContent)
}
