package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"math"
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

		CREATE TABLE IF NOT EXISTS customer_payments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
			amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
			payment_method VARCHAR(50) NOT NULL DEFAULT 'efectivo',
			bank_details TEXT DEFAULT '',
			notes TEXT DEFAULT '',
			registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
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
		       COALESCE((SELECT SUM(s.pending_amount) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada'), 0) AS total_debt,
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
		if err := rows.Scan(&c.ID, &c.FirstName, &c.LastName, &c.Phone, &c.Email, &c.Notes, &c.CreatedBy, &c.CreatedByUsername, &c.CreatedAt, &c.UpdatedAt, &c.TotalSpent, &c.TotalOrders, &c.TotalDebt, &c.LastOrderDate); err != nil {
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
		       COALESCE((SELECT SUM(s.pending_amount) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada'), 0) AS total_debt,
		       (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada') AS last_order_date
		FROM customers c
		WHERE c.id = $1
	`, customerID).Scan(&c.ID, &c.FirstName, &c.LastName, &c.Phone, &c.Email, &c.Notes, &c.CreatedBy, &c.CreatedByUsername, &c.CreatedAt, &c.UpdatedAt, &c.TotalSpent, &c.TotalOrders, &c.TotalDebt, &c.LastOrderDate)

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
		       s.total, COALESCE(s.paid_amount, s.total), COALESCE(s.pending_amount, 0), COALESCE(s.payment_status, 'paid'),
		       COALESCE(c.status, 'completada'), s.created_at
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
			_ = salesRows.Scan(&s.ID, &s.SoldBy, &s.SoldByUsername, &s.CustomerName, &s.PaymentMethod, &s.CashAmount, &s.TransferAmount, &s.BankDetails, &s.Subtotal, &s.DiscountPercent, &s.DiscountAmount, &s.DiscountReason, &s.Total, &s.PaidAmount, &s.PendingAmount, &s.PaymentStatus, &s.Status, &s.CreatedAt)
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

// GET /customers/{id}/account - Resumen 360 de estado de cuenta y facturas pendientes
func (h *CustomerHandler) GetAccount(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var c models.Customer
	err = h.DB.QueryRow(ctx, `
		SELECT c.id, c.first_name, COALESCE(c.last_name, ''), COALESCE(c.phone, ''), 
		       COALESCE(c.email, ''), COALESCE(c.notes, ''), c.created_by, COALESCE(c.created_by_username, ''),
		       c.created_at, c.updated_at,
		       COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada'), 0) AS total_spent,
		       COALESCE((SELECT COUNT(s.id) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada'), 0) AS total_orders,
		       COALESCE((SELECT SUM(s.pending_amount) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada'), 0) AS total_debt,
		       (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.status != 'cancelada') AS last_order_date
		FROM customers c
		WHERE c.id = $1
	`, customerID).Scan(&c.ID, &c.FirstName, &c.LastName, &c.Phone, &c.Email, &c.Notes, &c.CreatedBy, &c.CreatedByUsername, &c.CreatedAt, &c.UpdatedAt, &c.TotalSpent, &c.TotalOrders, &c.TotalDebt, &c.LastOrderDate)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "cliente no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("error obteniendo cliente para cuenta: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}

	// 1. Obtener ventas pendientes con saldo deudor
	pendingRows, err := h.DB.Query(ctx, `
		SELECT s.id, COALESCE(s.sold_by, '00000000-0000-0000-0000-000000000000'::uuid),
		       COALESCE(NULLIF(s.sold_by_name, ''), u.username, 'Personal'),
		       s.customer_name, s.payment_method, s.cash_amount, s.transfer_amount,
		       COALESCE(s.bank_details, ''), s.subtotal, s.discount_percent,
		       s.discount_amount, s.discount_reason, s.total,
		       COALESCE(s.paid_amount, s.total), COALESCE(s.pending_amount, 0),
		       COALESCE(s.payment_status, 'paid'), COALESCE(c.status, 'completada'), s.created_at,
		       COALESCE(
		         (SELECT json_agg(json_build_object(
		            'product_id', si.product_id,
		            'product_name', COALESCE(NULLIF(si.product_name, ''), p.name, 'Producto Eliminado'),
		            'quantity', si.quantity,
		            'unit_price', si.unit_price))
		          FROM sale_items si
		          LEFT JOIN products p ON si.product_id = p.id
		          WHERE si.sale_id = s.id), '[]'::json) AS items
		FROM sales s
		LEFT JOIN users u ON s.sold_by = u.id
		LEFT JOIN comandas c ON c.sale_id = s.id
		WHERE s.customer_id = $1 AND s.pending_amount > 0 AND s.status != 'cancelada'
		ORDER BY s.created_at ASC
	`, customerID)

	var pendingSales []models.Sale
	if err == nil {
		defer pendingRows.Close()
		for pendingRows.Next() {
			var s models.Sale
			var itemsJSON []byte
			if err := pendingRows.Scan(&s.ID, &s.SoldBy, &s.SoldByUsername, &s.CustomerName,
				&s.PaymentMethod, &s.CashAmount, &s.TransferAmount, &s.BankDetails,
				&s.Subtotal, &s.DiscountPercent, &s.DiscountAmount, &s.DiscountReason,
				&s.Total, &s.PaidAmount, &s.PendingAmount, &s.PaymentStatus, &s.Status,
				&s.CreatedAt, &itemsJSON); err == nil {
				if len(itemsJSON) > 0 {
					_ = json.Unmarshal(itemsJSON, &s.Items)
				}
				pendingSales = append(pendingSales, s)
			}
		}
	}
	if pendingSales == nil {
		pendingSales = []models.Sale{}
	}

	// 2. Historial de Abonos / Pagos del cliente
	payRows, err := h.DB.Query(ctx, `
		SELECT cp.id, cp.customer_id, cp.amount, cp.payment_method, COALESCE(cp.bank_details, ''),
		       COALESCE(cp.notes, ''), cp.registered_by, COALESCE(u.username, 'Personal'), cp.created_at
		FROM customer_payments cp
		LEFT JOIN users u ON cp.registered_by = u.id
		WHERE cp.customer_id = $1
		ORDER BY cp.created_at DESC
	`, customerID)

	var paymentHistory []models.CustomerPayment
	if err == nil {
		defer payRows.Close()
		for payRows.Next() {
			var p models.CustomerPayment
			if err := payRows.Scan(&p.ID, &p.CustomerID, &p.Amount, &p.PaymentMethod, &p.BankDetails,
				&p.Notes, &p.RegisteredBy, &p.RegisteredName, &p.CreatedAt); err == nil {
				paymentHistory = append(paymentHistory, p)
			}
		}
	}
	if paymentHistory == nil {
		paymentHistory = []models.CustomerPayment{}
	}

	// 3. Totales acumulados
	var totalSales, totalPaid, currentDebt float64
	_ = h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(total), 0), COALESCE(SUM(paid_amount), 0), COALESCE(SUM(pending_amount), 0)
		FROM sales
		WHERE customer_id = $1 AND status != 'cancelada'
	`, customerID).Scan(&totalSales, &totalPaid, &currentDebt)

	c.TotalDebt = currentDebt

	summary := models.CustomerAccountSummary{
		Customer:       c,
		TotalSales:     totalSales,
		TotalPaid:      totalPaid,
		CurrentDebt:    currentDebt,
		PendingSales:   pendingSales,
		PaymentHistory: paymentHistory,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

type paymentReq struct {
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"payment_method"`
	BankDetails   string  `json:"bank_details"`
	Notes         string  `json:"notes"`
	CustomDate    *string `json:"custom_date"`
}

// POST /customers/{id}/payments - Registrar un Abono y amortizar deudas en orden FIFO
func (h *CustomerHandler) CreatePayment(w http.ResponseWriter, r *http.Request) {
	customerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var req paymentReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}

	if req.Amount <= 0 {
		http.Error(w, "el monto del abono debe ser mayor a cero", http.StatusBadRequest)
		return
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "efectivo"
	}

	paymentTime := time.Now()
	if req.CustomDate != nil && *req.CustomDate != "" {
		if t, err := time.Parse(time.RFC3339, *req.CustomDate); err == nil {
			paymentTime = t
		} else if t, err := time.Parse("2006-01-02T15:04:05", *req.CustomDate); err == nil {
			paymentTime = t
		} else if t, err := time.Parse("2006-01-02T15:04", *req.CustomDate); err == nil {
			paymentTime = t
		}
	}

	ctx := r.Context()
	soldByVal := ctx.Value(custommw.ContextUserID)
	var registeredBy *uuid.UUID
	if soldByVal != nil {
		if id, ok := soldByVal.(uuid.UUID); ok && id != uuid.Nil {
			registeredBy = &id
		} else if idStr, ok := soldByVal.(string); ok {
			if id, err := uuid.Parse(idStr); err == nil && id != uuid.Nil {
				registeredBy = &id
			}
		}
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		log.Printf("error iniciando transacción de abono: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Verificar cliente
	var customerName string
	err = tx.QueryRow(ctx, `SELECT TRIM(first_name || ' ' || last_name) FROM customers WHERE id = $1`, customerID).Scan(&customerName)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "cliente no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}

	// 1. Insertar el abono en customer_payments
	var paymentID uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO customer_payments (customer_id, amount, payment_method, bank_details, notes, registered_by, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id`,
		customerID, req.Amount, paymentMethod, strings.TrimSpace(req.BankDetails),
		strings.TrimSpace(req.Notes), registeredBy, paymentTime,
	).Scan(&paymentID)

	if err != nil {
		log.Printf("error guardando abono: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}

	// 2. Amortizar deudas de ventas pendientes en orden FIFO (Venta más antigua a más reciente)
	rows, err := tx.Query(ctx,
		`SELECT id, total, COALESCE(paid_amount, 0), COALESCE(pending_amount, total)
		 FROM sales
		 WHERE customer_id = $1 AND pending_amount > 0 AND status != 'cancelada'
		 ORDER BY created_at ASC`, customerID)

	if err != nil {
		log.Printf("error consultando facturas pendientes para amortizar: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}

	type pendingSaleItem struct {
		id      uuid.UUID
		total   float64
		paid    float64
		pending float64
	}
	var salesToAmortize []pendingSaleItem
	for rows.Next() {
		var s pendingSaleItem
		if err := rows.Scan(&s.id, &s.total, &s.paid, &s.pending); err == nil {
			salesToAmortize = append(salesToAmortize, s)
		}
	}
	rows.Close()

	remainingAbono := req.Amount
	for _, sale := range salesToAmortize {
		if remainingAbono <= 0 {
			break
		}

		applyAmt := math.Min(remainingAbono, sale.pending)
		newPaid := sale.paid + applyAmt
		newPending := math.Max(0, sale.pending-applyAmt)
		newStatus := "partial"
		if newPending <= 0 {
			newStatus = "paid"
		}

		_, err = tx.Exec(ctx,
			`UPDATE sales SET paid_amount = $1, pending_amount = $2, payment_status = $3 WHERE id = $4`,
			newPaid, newPending, newStatus, sale.id)

		if err != nil {
			log.Printf("error actualizando venta amortizada %s: %v", sale.id, err)
			http.Error(w, "error amortizando saldo", http.StatusInternalServerError)
			return
		}

		remainingAbono -= applyAmt
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("error confirmando transacción de abono: %v", err)
		http.Error(w, "error interno confirmando abono", http.StatusInternalServerError)
		return
	}

	var newDebt float64
	_ = h.DB.QueryRow(r.Context(), `SELECT COALESCE(SUM(pending_amount), 0) FROM sales WHERE customer_id = $1 AND status != 'cancelada'`, customerID).Scan(&newDebt)

	if h.Hub != nil {
		h.Hub.Publish("customer_payment_created", map[string]interface{}{
			"payment_id":     paymentID,
			"customer_id":    customerID,
			"customer_name":  customerName,
			"amount":         req.Amount,
			"payment_method": paymentMethod,
			"new_debt":       newDebt,
			"created_at":     paymentTime,
		})
		h.Hub.Publish("customer_updated", map[string]interface{}{
			"id":         customerID,
			"total_debt": newDebt,
		})
		h.Hub.Publish("accounting_updated", map[string]interface{}{
			"source": "customer_payment",
			"amount": req.Amount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"payment_id":     paymentID,
		"customer_id":    customerID,
		"customer_name":  customerName,
		"amount":         req.Amount,
		"payment_method": paymentMethod,
		"new_debt":       newDebt,
		"created_at":     paymentTime,
	})
}

