package handlers

import (
	"context"
	"encoding/json"
	"errors"
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

type CustomerHandler struct {
	DB  *pgxpool.Pool
	Hub *events.Hub
}

func NewCustomerHandler(db *pgxpool.Pool, hub *events.Hub) *CustomerHandler {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, _ = db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS customers (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			first_name VARCHAR(100) NOT NULL,
			last_name VARCHAR(100) NOT NULL DEFAULT '',
			phone VARCHAR(30) DEFAULT '',
			email VARCHAR(150) DEFAULT '',
			notes TEXT DEFAULT '',
			created_by UUID,
			created_by_username VARCHAR(100) DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(first_name, last_name);
		CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
	`)

	return &CustomerHandler{DB: db, Hub: hub}
}

// GET /customers
func (h *CustomerHandler) List(w http.ResponseWriter, r *http.Request) {
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	baseQuery := `
		SELECT c.id, c.first_name, COALESCE(c.last_name, ''), COALESCE(c.phone, ''), 
		       COALESCE(c.email, ''), COALESCE(c.notes, ''), c.created_by, COALESCE(c.created_by_username, ''),
		       c.created_at, c.updated_at,
		       COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada'), 0) AS total_spent,
		       COALESCE((SELECT COUNT(s.id) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada'), 0) AS total_orders,
		       (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada') AS last_order_date
		FROM customers c
	`

	var rows pgx.Rows
	var err error

	if search != "" {
		pattern := "%" + search + "%"
		query := baseQuery + `
			WHERE c.first_name ILIKE $1 OR c.last_name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1 OR c.notes ILIKE $1
			ORDER BY total_spent DESC, c.first_name ASC
		`
		rows, err = h.DB.Query(r.Context(), query, pattern)
	} else {
		query := baseQuery + ` ORDER BY total_spent DESC, c.first_name ASC`
		rows, err = h.DB.Query(r.Context(), query)
	}

	if err != nil {
		log.Printf("error consultando clientes: %v", err)
		http.Error(w, "error consultando clientes", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var customers []models.Customer
	for rows.Next() {
		var c models.Customer
		if err := rows.Scan(&c.ID, &c.FirstName, &c.LastName, &c.Phone, &c.Email, &c.Notes, &c.CreatedBy, &c.CreatedByUsername, &c.CreatedAt, &c.UpdatedAt, &c.TotalSpent, &c.TotalOrders, &c.LastOrderDate); err != nil {
			log.Printf("error leyendo cliente: %v", err)
			http.Error(w, "error leyendo cliente", http.StatusInternalServerError)
			return
		}
		customers = append(customers, c)
	}

	if customers == nil {
		customers = []models.Customer{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(customers)
}

// GET /customers/{id}
func (h *CustomerHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var c models.Customer
	err = h.DB.QueryRow(r.Context(), `
		SELECT c.id, c.first_name, COALESCE(c.last_name, ''), COALESCE(c.phone, ''), 
		       COALESCE(c.email, ''), COALESCE(c.notes, ''), c.created_by, COALESCE(c.created_by_username, ''),
		       c.created_at, c.updated_at,
		       COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada'), 0) AS total_spent,
		       COALESCE((SELECT COUNT(s.id) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada'), 0) AS total_orders,
		       (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada') AS last_order_date
		FROM customers c
		WHERE c.id = $1
	`, customerID).Scan(&c.ID, &c.FirstName, &c.LastName, &c.Phone, &c.Email, &c.Notes, &c.CreatedBy, &c.CreatedByUsername, &c.CreatedAt, &c.UpdatedAt, &c.TotalSpent, &c.TotalOrders, &c.LastOrderDate)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "cliente no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("error obteniendo cliente: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}

	salesRows, err := h.DB.Query(r.Context(), `
		SELECT s.id, COALESCE(s.sold_by, '00000000-0000-0000-0000-000000000000'::uuid), 
		       COALESCE(s.sold_by_name, COALESCE(u.username, 'Personal')),
		       s.customer_name, s.payment_method, s.cash_amount, s.transfer_amount, 
		       COALESCE(s.bank_details, ''), COALESCE(s.subtotal, s.total),
		       COALESCE(s.discount_percent, 0), COALESCE(s.discount_amount, 0), COALESCE(s.discount_reason, ''),
		       s.total, COALESCE(c.status, 'completada'), s.created_at
		FROM sales s
		LEFT JOIN users u ON s.sold_by = u.id
		LEFT JOIN comandas c ON c.sale_id = s.id
		WHERE s.customer_id = $1
		ORDER BY s.created_at DESC
	`, customerID)
	if err == nil {
		defer salesRows.Close()
		var sales []models.Sale
		for salesRows.Next() {
			var s models.Sale
			_ = salesRows.Scan(&s.ID, &s.SoldBy, &s.SoldByUsername, &s.CustomerName, &s.PaymentMethod, &s.CashAmount, &s.TransferAmount, &s.BankDetails, &s.Subtotal, &s.DiscountPercent, &s.DiscountAmount, &s.DiscountReason, &s.Total, &s.Status, &s.CreatedAt)
			sales = append(sales, s)
		}

		type CustomerDetailResponse struct {
			Customer models.Customer `json:"customer"`
			Sales    []models.Sale   `json:"sales"`
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(CustomerDetailResponse{Customer: c, Sales: sales})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

type createCustomerRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
	Notes     string `json:"notes"`
}

// POST /customers
func (h *CustomerHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}

	req.FirstName = strings.TrimSpace(req.FirstName)
	if req.FirstName == "" {
		http.Error(w, "el nombre es obligatorio", http.StatusBadRequest)
		return
	}

	var userID *uuid.UUID
	var username string

	if uVal := r.Context().Value(custommw.ContextUserID); uVal != nil {
		if uid, ok := uVal.(uuid.UUID); ok {
			userID = &uid
			_ = h.DB.QueryRow(r.Context(), `SELECT username FROM users WHERE id = $1`, uid).Scan(&username)
		}
	}
	if username == "" {
		username = "Personal"
	}

	var c models.Customer
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO customers (first_name, last_name, phone, email, notes, created_by, created_by_username, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
		RETURNING id, first_name, last_name, phone, email, notes, created_by, created_by_username, created_at, updated_at
	`, req.FirstName, strings.TrimSpace(req.LastName), strings.TrimSpace(req.Phone), strings.TrimSpace(req.Email), strings.TrimSpace(req.Notes), userID, username).Scan(
		&c.ID, &c.FirstName, &c.LastName, &c.Phone, &c.Email, &c.Notes, &c.CreatedBy, &c.CreatedByUsername, &c.CreatedAt, &c.UpdatedAt,
	)

	if err != nil {
		log.Printf("error creando cliente: %v", err)
		http.Error(w, "error creando cliente", http.StatusInternalServerError)
		return
	}

	if h.Hub != nil {
		h.Hub.Publish("customer_created", c)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

// PUT /customers/{id}
func (h *CustomerHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var req createCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}

	req.FirstName = strings.TrimSpace(req.FirstName)
	if req.FirstName == "" {
		http.Error(w, "el nombre es obligatorio", http.StatusBadRequest)
		return
	}

	var c models.Customer
	err = h.DB.QueryRow(r.Context(), `
		UPDATE customers
		SET first_name = $1, last_name = $2, phone = $3, email = $4, notes = $5, updated_at = now()
		WHERE id = $6
		RETURNING id, first_name, last_name, phone, email, notes, created_by, created_by_username, created_at, updated_at
	`, req.FirstName, strings.TrimSpace(req.LastName), strings.TrimSpace(req.Phone), strings.TrimSpace(req.Email), strings.TrimSpace(req.Notes), customerID).Scan(
		&c.ID, &c.FirstName, &c.LastName, &c.Phone, &c.Email, &c.Notes, &c.CreatedBy, &c.CreatedByUsername, &c.CreatedAt, &c.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "cliente no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("error actualizando cliente: %v", err)
		http.Error(w, "error actualizando cliente", http.StatusInternalServerError)
		return
	}

	if h.Hub != nil {
		h.Hub.Publish("customer_updated", c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

// DELETE /customers/{id}
func (h *CustomerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	_, _ = h.DB.Exec(r.Context(), `UPDATE sales SET customer_id = NULL WHERE customer_id = $1`, customerID)

	tag, err := h.DB.Exec(r.Context(), `DELETE FROM customers WHERE id = $1`, customerID)
	if err != nil {
		log.Printf("error eliminando cliente: %v", err)
		http.Error(w, "error eliminando cliente", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "cliente no encontrado", http.StatusNotFound)
		return
	}

	if h.Hub != nil {
		h.Hub.Publish("customer_deleted", map[string]string{"id": idStr})
	}

	w.WriteHeader(http.StatusNoContent)
}
