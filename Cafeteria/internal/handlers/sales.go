package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
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

type SaleHandler struct {
	DB  *pgxpool.Pool
	Hub *events.Hub
}

func NewSaleHandler(db *pgxpool.Pool, hub *events.Hub) *SaleHandler {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_details TEXT DEFAULT ''`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS sold_by_name TEXT DEFAULT ''`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_reason TEXT DEFAULT ''`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id UUID`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) DEFAULT 0`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(10,2) DEFAULT 0`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'paid'`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ALTER COLUMN sold_by DROP NOT NULL`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_status_check`)
	_, _ = db.Exec(ctx, `ALTER TABLE sales ALTER COLUMN payment_method TYPE VARCHAR(50)`)
	_, _ = db.Exec(ctx, `
		DO $$ 
		DECLARE
			r RECORD;
		BEGIN
			FOR r IN (
				SELECT conname 
				FROM pg_constraint 
				WHERE conrelid = 'sales'::regclass 
				  AND contype = 'c' 
				  AND pg_get_constraintdef(oid) LIKE '%payment_method%'
			) LOOP
				EXECUTE 'ALTER TABLE sales DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
			END LOOP;
		END $$;
	`)
	_, _ = db.Exec(ctx, `UPDATE sales SET subtotal = total WHERE (subtotal = 0 OR subtotal IS NULL) AND total > 0`)
	_, _ = db.Exec(ctx, `UPDATE sales SET paid_amount = total, pending_amount = 0, payment_status = 'paid' WHERE (paid_amount = 0 OR paid_amount IS NULL) AND (pending_amount = 0 OR pending_amount IS NULL) AND total > 0`)

	_, _ = db.Exec(ctx, `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS product_name TEXT DEFAULT ''`)
	_, _ = db.Exec(ctx, `UPDATE sale_items si SET product_name = p.name FROM products p WHERE si.product_id = p.id AND (si.product_name IS NULL OR si.product_name = '')`)

	_, _ = db.Exec(ctx, `
		DO $$ 
		BEGIN 
			IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sales_sold_by_fkey') THEN
				ALTER TABLE sales DROP CONSTRAINT sales_sold_by_fkey;
			END IF;
			ALTER TABLE sales ADD CONSTRAINT sales_sold_by_fkey FOREIGN KEY (sold_by) REFERENCES users(id) ON DELETE SET NULL;
		END $$;
	`)

	return &SaleHandler{DB: db, Hub: hub}
}

// GET /sales?period=today|week|month|all&start_date=...&end_date=...&year=...&month_num=...&debt_status=...
func (h *SaleHandler) List(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	startDate := strings.TrimSpace(r.URL.Query().Get("start_date"))
	endDate := strings.TrimSpace(r.URL.Query().Get("end_date"))
	yearParam := strings.TrimSpace(r.URL.Query().Get("year"))
	monthParam := strings.TrimSpace(r.URL.Query().Get("month_num"))
	debtStatus := strings.TrimSpace(r.URL.Query().Get("debt_status"))

	roleVal := r.Context().Value(custommw.ContextRole)
	var userRole models.UserRole
	if rRole, ok := roleVal.(models.UserRole); ok {
		userRole = rRole
	} else if rStr, ok := roleVal.(string); ok {
		userRole = models.UserRole(rStr)
	}

	isOwnerOrAdmin := userRole == models.RoleOwner || userRole == models.RoleAdmin || string(userRole) == "dueño" || string(userRole) == "administrador"
	if !isOwnerOrAdmin && userRole != "" {
		if period != "today" && period != "week" {
			period = "today"
		}
		startDate = ""
		endDate = ""
		yearParam = ""
		monthParam = ""
	}

	var rawCond string

	if startDate != "" && endDate != "" {
		rawCond = fmt.Sprintf("s.created_at >= '%s 00:00:00' AND s.created_at <= '%s 23:59:59'", startDate, endDate)
	} else if yearParam != "" && monthParam != "" {
		y, _ := strconv.Atoi(yearParam)
		m, _ := strconv.Atoi(monthParam)
		if y > 2000 && m >= 1 && m <= 12 {
			rawCond = fmt.Sprintf("EXTRACT(YEAR FROM s.created_at) = %d AND EXTRACT(MONTH FROM s.created_at) = %d", y, m)
		}
	}

	if rawCond == "" {
		switch period {
		case "today":
			rawCond = "(s.created_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date"
		case "week":
			rawCond = "s.created_at >= (now() - INTERVAL '7 days')"
		case "month":
			rawCond = "s.created_at >= date_trunc('month', now())"
		case "prev_month":
			rawCond = "s.created_at >= date_trunc('month', now() - INTERVAL '1 month') AND s.created_at < date_trunc('month', now())"
		case "year":
			rawCond = "s.created_at >= date_trunc('year', now())"
		default: // "all"
			rawCond = ""
		}
	}

	var conditions []string
	if rawCond != "" {
		conditions = append(conditions, rawCond)
	}
	if debtStatus == "debt" {
		conditions = append(conditions, "s.pending_amount > 0")
	} else if debtStatus == "paid" {
		conditions = append(conditions, "s.pending_amount = 0")
	}

	var whereClause string
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	query := fmt.Sprintf(`SELECT s.id, COALESCE(s.sold_by, '00000000-0000-0000-0000-000000000000'::uuid), 
		        COALESCE(NULLIF(s.sold_by_name, ''), u.username, 'Personal'),
		        s.customer_id,
		        COALESCE(s.customer_name, 'Cliente General'), 
		        COALESCE(s.payment_method, 'efectivo'), COALESCE(s.cash_amount, 0), COALESCE(s.transfer_amount, 0), 
		        COALESCE(s.bank_details, ''),
		        COALESCE(s.subtotal, s.total),
		        COALESCE(s.discount_percent, 0),
		        COALESCE(s.discount_amount, 0),
		        COALESCE(s.discount_reason, ''),
		        s.total,
		        COALESCE(s.paid_amount, s.total),
		        COALESCE(s.pending_amount, 0),
		        COALESCE(s.payment_status, 'paid'),
		        COALESCE(c.status, 'completada') AS status, s.created_at,
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
		 %s
		 ORDER BY s.created_at DESC`, whereClause)

	rows, err := h.DB.Query(r.Context(), query)
	if err != nil {
		log.Printf("error consultando ventas: %v", err)
		http.Error(w, "error consultando ventas", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var sales []models.Sale
	for rows.Next() {
		var s models.Sale
		var itemsJSON []byte
		if err := rows.Scan(&s.ID, &s.SoldBy, &s.SoldByUsername, &s.CustomerID, &s.CustomerName,
			&s.PaymentMethod, &s.CashAmount, &s.TransferAmount, &s.BankDetails,
			&s.Subtotal, &s.DiscountPercent, &s.DiscountAmount, &s.DiscountReason,
			&s.Total, &s.PaidAmount, &s.PendingAmount, &s.PaymentStatus,
			&s.Status, &s.CreatedAt, &itemsJSON); err != nil {
			log.Printf("error leyendo ventas: %v", err)
			http.Error(w, "error leyendo ventas", http.StatusInternalServerError)
			return
		}
		if len(itemsJSON) > 0 {
			_ = json.Unmarshal(itemsJSON, &s.Items)
		}
		sales = append(sales, s)
	}

	if sales == nil {
		sales = []models.Sale{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sales)
}

// GET /sales/{id}
func (h *SaleHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var s models.Sale
	err = h.DB.QueryRow(r.Context(),
		`SELECT s.id, COALESCE(s.sold_by, '00000000-0000-0000-0000-000000000000'::uuid), 
		        COALESCE(NULLIF(s.sold_by_name, ''), u.username, 'Personal'), 
		        s.customer_id,
		        COALESCE(s.customer_name, 'Cliente General'), 
		        COALESCE(s.payment_method, 'efectivo'), COALESCE(s.cash_amount, 0), COALESCE(s.transfer_amount, 0), 
		        COALESCE(s.bank_details, ''),
		        COALESCE(s.subtotal, s.total),
		        COALESCE(s.discount_percent, 0),
		        COALESCE(s.discount_amount, 0),
		        COALESCE(s.discount_reason, ''),
		        s.total,
		        COALESCE(s.paid_amount, s.total),
		        COALESCE(s.pending_amount, 0),
		        COALESCE(s.payment_status, 'paid'),
		        s.created_at 
		 FROM sales s
		 LEFT JOIN users u ON s.sold_by = u.id
		 WHERE s.id = $1`, id,
	).Scan(&s.ID, &s.SoldBy, &s.SoldByUsername, &s.CustomerID, &s.CustomerName,
		&s.PaymentMethod, &s.CashAmount, &s.TransferAmount, &s.BankDetails,
		&s.Subtotal, &s.DiscountPercent, &s.DiscountAmount, &s.DiscountReason,
		&s.Total, &s.PaidAmount, &s.PendingAmount, &s.PaymentStatus, &s.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "venta no encontrada", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("error consultando venta: %v", err)
		http.Error(w, "error consultando venta", http.StatusInternalServerError)
		return
	}

	rows, err := h.DB.Query(r.Context(),
		`SELECT si.product_id, COALESCE(NULLIF(si.product_name, ''), p.name, 'Producto Eliminado'), si.quantity, si.unit_price 
		 FROM sale_items si
		 LEFT JOIN products p ON si.product_id = p.id
		 WHERE si.sale_id = $1`, id)
	if err != nil {
		log.Printf("error consultando items: %v", err)
		http.Error(w, "error consultando items", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var item models.SaleItem
		if err := rows.Scan(&item.ProductID, &item.ProductName, &item.Quantity, &item.UnitPrice); err != nil {
			log.Printf("error leyendo items: %v", err)
			http.Error(w, "error leyendo items", http.StatusInternalServerError)
			return
		}
		s.Items = append(s.Items, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

type createSaleRequest struct {
	CustomerID      *uuid.UUID `json:"customer_id"`
	CustomerName    string     `json:"customer_name"`
	PaymentMethod   string     `json:"payment_method"`
	PaidAmount      *float64   `json:"paid_amount"`
	CashAmount      float64    `json:"cash_amount"`
	TransferAmount  float64    `json:"transfer_amount"`
	BankDetails     string     `json:"bank_details"`
	DiscountPercent float64    `json:"discount_percent"`
	DiscountAmount  float64    `json:"discount_amount"`
	DiscountReason  string     `json:"discount_reason"`
	Items           []struct {
		ProductID uuid.UUID `json:"product_id"`
		Quantity  int       `json:"quantity"`
		Notes     string    `json:"notes"`
	} `json:"items"`
}

func (h *SaleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createSaleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}
	if len(req.Items) == 0 {
		http.Error(w, "la venta debe tener al menos un producto", http.StatusBadRequest)
		return
	}
	for _, item := range req.Items {
		if item.Quantity <= 0 {
			http.Error(w, "la cantidad debe ser mayor a cero", http.StatusBadRequest)
			return
		}
	}

	ctx := r.Context()
	userRole, _ := ctx.Value(custommw.ContextRole).(models.UserRole)
	isOwner := userRole == models.RoleOwner || string(userRole) == "dueño"

	if (req.DiscountPercent > 0 || req.DiscountAmount > 0) && !isOwner {
		http.Error(w, "solo los dueños pueden aplicar descuentos", http.StatusForbidden)
		return
	}

	customerName := strings.TrimSpace(req.CustomerName)
	if customerName == "" && req.CustomerID != nil {
		_ = h.DB.QueryRow(ctx, `SELECT CONCAT(first_name, ' ', last_name) FROM customers WHERE id = $1`, req.CustomerID).Scan(&customerName)
	}
	customerName = strings.TrimSpace(customerName)
	if customerName == "" {
		customerName = "Cliente General"
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "efectivo"
	}
	if paymentMethod != "efectivo" && paymentMethod != "transferencia" && paymentMethod != "mixto" && paymentMethod != "credito" {
		http.Error(w, "método de pago inválido", http.StatusBadRequest)
		return
	}

	soldByVal := ctx.Value(custommw.ContextUserID)
	var soldBy uuid.UUID
	if soldByVal != nil {
		if id, ok := soldByVal.(uuid.UUID); ok {
			soldBy = id
		} else if idStr, ok := soldByVal.(string); ok {
			soldBy, _ = uuid.Parse(idStr)
		}
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		log.Printf("error iniciando transacción: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var subtotal float64
	type resolvedItem struct {
		ProductID   uuid.UUID
		ProductName string
		Quantity    int
		UnitPrice   float64
		Notes       string
	}
	var resolved []resolvedItem

	for _, item := range req.Items {
		var name string
		var price float64
		var active bool
		err := tx.QueryRow(ctx,
			`SELECT name, price, active FROM products WHERE id = $1`, item.ProductID,
		).Scan(&name, &price, &active)
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, fmt.Sprintf("producto %s no existe", item.ProductID), http.StatusBadRequest)
			return
		}
		if err != nil {
			log.Printf("error consultando producto: %v", err)
			http.Error(w, "error interno", http.StatusInternalServerError)
			return
		}
		if !active {
			http.Error(w, fmt.Sprintf("producto %s no está disponible", name), http.StatusBadRequest)
			return
		}

		subtotal += price * float64(item.Quantity)
		resolved = append(resolved, resolvedItem{
			ProductID:   item.ProductID,
			ProductName: name,
			Quantity:    item.Quantity,
			UnitPrice:   price,
			Notes:       item.Notes,
		})
	}

	discountPercent := math.Max(0, req.DiscountPercent)
	discountAmount := math.Max(0, req.DiscountAmount)
	if discountPercent > 0 {
		discountAmount = subtotal * (discountPercent / 100.0)
	}
	total := math.Max(0, subtotal-discountAmount)

	paidAmount := total
	if req.PaidAmount != nil {
		paidAmount = *req.PaidAmount
		if paidAmount < 0 {
			paidAmount = 0
		}
		if paidAmount > total {
			paidAmount = total
		}
	} else if paymentMethod == "credito" {
		paidAmount = 0
	}
	pendingAmount := math.Max(0, total-paidAmount)

	if pendingAmount > 0 && req.CustomerID == nil {
		http.Error(w, "debe seleccionar un cliente registrado para ventas a crédito o con saldo pendiente", http.StatusBadRequest)
		return
	}

	paymentStatus := "paid"
	if pendingAmount > 0 {
		if paidAmount > 0 {
			paymentStatus = "partial"
		} else {
			paymentStatus = "pending"
		}
	}

	cashAmount := req.CashAmount
	transferAmount := req.TransferAmount
	if paymentMethod == "efectivo" {
		cashAmount = paidAmount
		transferAmount = 0
	} else if paymentMethod == "transferencia" {
		cashAmount = 0
		transferAmount = paidAmount
	} else if paymentMethod == "credito" {
		cashAmount = 0
		transferAmount = 0
	} else if paymentMethod == "mixto" {
		if cashAmount+transferAmount < paidAmount {
			http.Error(w, "el pago total en mixto es inferior al monto abonado", http.StatusBadRequest)
			return
		}
	}

	for _, item := range resolved {
		rows, err := tx.Query(ctx,
			`SELECT ingredient_id, quantity_used FROM product_ingredients WHERE product_id = $1`,
			item.ProductID)
		if err != nil {
			log.Printf("error consultando receta: %v", err)
			http.Error(w, "error interno", http.StatusInternalServerError)
			return
		}

		type recipeLine struct {
			IngredientID uuid.UUID
			QtyUsed      float64
		}
		var recipe []recipeLine
		for rows.Next() {
			var rl recipeLine
			if err := rows.Scan(&rl.IngredientID, &rl.QtyUsed); err != nil {
				rows.Close()
				log.Printf("error leyendo receta: %v", err)
				http.Error(w, "error interno", http.StatusInternalServerError)
				return
			}
			recipe = append(recipe, rl)
		}
		rows.Close()

		for _, rl := range recipe {
			needed := rl.QtyUsed * float64(item.Quantity)
			tag, err := tx.Exec(ctx,
				`UPDATE ingredients SET quantity = quantity - $1
				 WHERE id = $2 AND quantity >= $1`,
				needed, rl.IngredientID)
			if err != nil {
				log.Printf("error descontando insumo: %v", err)
				http.Error(w, "error interno", http.StatusInternalServerError)
				return
			}
			if tag.RowsAffected() == 0 {
				http.Error(w, "no hay suficiente inventario para completar la venta", http.StatusConflict)
				return
			}
		}
	}

	var soldByName string
	if soldBy != uuid.Nil {
		_ = tx.QueryRow(ctx, `SELECT COALESCE(username, '') FROM users WHERE id = $1`, soldBy).Scan(&soldByName)
	}
	if soldByName == "" {
		soldByName = "Personal"
	}

	var saleID uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO sales (sold_by, sold_by_name, customer_id, customer_name, payment_method, cash_amount, transfer_amount, bank_details, subtotal, discount_percent, discount_amount, discount_reason, total, paid_amount, pending_amount, payment_status, created_at) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now()) RETURNING id`,
		soldBy, soldByName, req.CustomerID, customerName, paymentMethod, cashAmount, transferAmount, strings.TrimSpace(req.BankDetails), subtotal, discountPercent, discountAmount, strings.TrimSpace(req.DiscountReason), total, paidAmount, pendingAmount, paymentStatus,
	).Scan(&saleID)
	if err != nil {
		log.Printf("error creando venta: %v", err)
		if strings.Contains(strings.ToLower(err.Error()), "payment_method") || strings.Contains(strings.ToLower(err.Error()), "constraint") {
			_, _ = h.DB.Exec(ctx, `ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check`)
			_, _ = h.DB.Exec(ctx, `ALTER TABLE sales ALTER COLUMN payment_method TYPE VARCHAR(50)`)
			_, _ = h.DB.Exec(ctx, `
				DO $$ 
				DECLARE
					r RECORD;
				BEGIN
					FOR r IN (
						SELECT conname 
						FROM pg_constraint 
						WHERE conrelid = 'sales'::regclass 
						  AND contype = 'c' 
						  AND pg_get_constraintdef(oid) LIKE '%payment_method%'
					) LOOP
						EXECUTE 'ALTER TABLE sales DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
					END LOOP;
				END $$;
			`)
			err = tx.QueryRow(ctx,
				`INSERT INTO sales (sold_by, sold_by_name, customer_id, customer_name, payment_method, cash_amount, transfer_amount, bank_details, subtotal, discount_percent, discount_amount, discount_reason, total, paid_amount, pending_amount, payment_status, created_at) 
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now()) RETURNING id`,
				soldBy, soldByName, req.CustomerID, customerName, paymentMethod, cashAmount, transferAmount, strings.TrimSpace(req.BankDetails), subtotal, discountPercent, discountAmount, strings.TrimSpace(req.DiscountReason), total, paidAmount, pendingAmount, paymentStatus,
			).Scan(&saleID)
		}
		if err != nil {
			log.Printf("error final creando venta: %v", err)
			http.Error(w, fmt.Sprintf("error creando venta: %v", err), http.StatusInternalServerError)
			return
		}
	}

	for _, item := range resolved {
		_, err = tx.Exec(ctx,
			`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price)
			 VALUES ($1, $2, $3, $4, $5)`,
			saleID, item.ProductID, item.ProductName, item.Quantity, item.UnitPrice)
		if err != nil {
			log.Printf("error creando item de venta: %v", err)
			http.Error(w, "error interno", http.StatusInternalServerError)
			return
		}
	}

	_, _ = tx.Exec(ctx, `
		DO $$
		DECLARE
			seq_name text;
		BEGIN
			IF (SELECT COUNT(*) FROM comandas) = 0 THEN
				seq_name := pg_get_serial_sequence('comandas', 'order_number');
				IF seq_name IS NOT NULL AND seq_name != '' THEN
					EXECUTE 'SELECT setval(' || quote_literal(seq_name) || ', 1, false)';
				ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'comandas_order_number_seq') THEN
					PERFORM setval('comandas_order_number_seq', 1, false);
				END IF;
			END IF;
		END $$;
	`)

	var comandaID uuid.UUID
	var orderNumber int
	err = tx.QueryRow(ctx,
		`INSERT INTO comandas (sale_id, customer_name, status, notes) 
		 VALUES ($1, $2, 'pendiente', '') RETURNING id, order_number`,
		saleID, customerName,
	).Scan(&comandaID, &orderNumber)
	if err != nil {
		log.Printf("error generando comanda: %v", err)
		http.Error(w, "error interno generando comanda", http.StatusInternalServerError)
		return
	}

	var comandaItems []models.ComandaItem
	for _, item := range resolved {
		_, err = tx.Exec(ctx,
			`INSERT INTO comanda_items (comanda_id, product_id, product_name, quantity, notes)
			 VALUES ($1, $2, $3, $4, $5)`,
			comandaID, item.ProductID, item.ProductName, item.Quantity, item.Notes)
		if err != nil {
			log.Printf("error registrando item de comanda: %v", err)
			http.Error(w, "error interno registrando comanda", http.StatusInternalServerError)
			return
		}
		comandaItems = append(comandaItems, models.ComandaItem{
			ProductID:   item.ProductID,
			ProductName: item.ProductName,
			Quantity:    item.Quantity,
			Notes:       item.Notes,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("error confirmando venta y comanda: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}

	h.Hub.Publish("sale_created", map[string]interface{}{
		"id":              saleID,
		"customer_id":     req.CustomerID,
		"customer_name":   customerName,
		"payment_method":  paymentMethod,
		"subtotal":        subtotal,
		"discount_amount": discountAmount,
		"total":           total,
		"paid_amount":     paidAmount,
		"pending_amount":  pendingAmount,
		"payment_status":  paymentStatus,
	})

	if req.CustomerID != nil {
		var newDebt float64
		_ = h.DB.QueryRow(ctx, `SELECT COALESCE(SUM(pending_amount), 0) FROM sales WHERE customer_id = $1 AND status != 'cancelada'`, req.CustomerID).Scan(&newDebt)
		h.Hub.Publish("customer_updated", map[string]interface{}{
			"id":         req.CustomerID,
			"total_debt": newDebt,
		})
	}

	h.Hub.Publish("comanda_created", map[string]interface{}{
		"id":            comandaID,
		"order_number":  orderNumber,
		"sale_id":       saleID,
		"customer_name": customerName,
		"status":        "pendiente",
		"items":         comandaItems,
	})

	h.Hub.Publish("inventory_updated", map[string]interface{}{"action": "sale_deduction"})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":              saleID,
		"comanda_id":      comandaID,
		"order_number":    orderNumber,
		"customer_name":   customerName,
		"subtotal":        subtotal,
		"discount_amount": discountAmount,
		"total":           total,
		"paid_amount":     paidAmount,
		"pending_amount":  pendingAmount,
		"payment_status":  paymentStatus,
	})
}

// PUT /sales/{id} — edición de venta (Exclusivo Owner)
func (h *SaleHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	saleID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var req createSaleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}
	if len(req.Items) == 0 {
		http.Error(w, "la venta debe tener al menos un producto", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		log.Printf("error iniciando transacción: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	oldItemsRows, err := tx.Query(ctx, `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`, saleID)
	if err != nil {
		log.Printf("error consultando items anteriores: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}
	type itemPair struct {
		productID uuid.UUID
		qty       int
	}
	var oldItems []itemPair
	for oldItemsRows.Next() {
		var ip itemPair
		if err := oldItemsRows.Scan(&ip.productID, &ip.qty); err == nil {
			oldItems = append(oldItems, ip)
		}
	}
	oldItemsRows.Close()

	for _, oi := range oldItems {
		rows, err := tx.Query(ctx, `SELECT ingredient_id, quantity_used FROM product_ingredients WHERE product_id = $1`, oi.productID)
		if err == nil {
			for rows.Next() {
				var ingID uuid.UUID
				var qtyUsed float64
				if err := rows.Scan(&ingID, &qtyUsed); err == nil {
					toReturn := qtyUsed * float64(oi.qty)
					_, _ = tx.Exec(ctx, `UPDATE ingredients SET quantity = quantity + $1 WHERE id = $2`, toReturn, ingID)
				}
			}
			rows.Close()
		}
	}

	var subtotal float64
	type resolvedItem struct {
		ProductID   uuid.UUID
		ProductName string
		Quantity    int
		UnitPrice   float64
		Notes       string
	}
	var resolved []resolvedItem

	for _, item := range req.Items {
		var name string
		var price float64
		err := tx.QueryRow(ctx, `SELECT name, price FROM products WHERE id = $1`, item.ProductID).Scan(&name, &price)
		if err != nil {
			http.Error(w, fmt.Sprintf("producto no encontrado: %s", item.ProductID), http.StatusBadRequest)
			return
		}
		subtotal += price * float64(item.Quantity)
		resolved = append(resolved, resolvedItem{
			ProductID:   item.ProductID,
			ProductName: name,
			Quantity:    item.Quantity,
			UnitPrice:   price,
			Notes:       item.Notes,
		})
	}

	discountPercent := math.Max(0, req.DiscountPercent)
	discountAmount := math.Max(0, req.DiscountAmount)
	if discountPercent > 0 {
		discountAmount = subtotal * (discountPercent / 100.0)
	}
	total := math.Max(0, subtotal-discountAmount)

	customerName := strings.TrimSpace(req.CustomerName)
	if customerName == "" && req.CustomerID != nil {
		_ = tx.QueryRow(ctx, `SELECT CONCAT(first_name, ' ', last_name) FROM customers WHERE id = $1`, req.CustomerID).Scan(&customerName)
	}
	if customerName == "" {
		customerName = "Cliente General"
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "efectivo"
	}

	paidAmount := total
	if req.PaidAmount != nil {
		paidAmount = *req.PaidAmount
		if paidAmount < 0 {
			paidAmount = 0
		}
		if paidAmount > total {
			paidAmount = total
		}
	} else if paymentMethod == "credito" {
		paidAmount = 0
	}
	pendingAmount := math.Max(0, total-paidAmount)
	paymentStatus := "paid"
	if pendingAmount > 0 {
		if paidAmount > 0 {
			paymentStatus = "partial"
		} else {
			paymentStatus = "pending"
		}
	}

	cashAmount := req.CashAmount
	transferAmount := req.TransferAmount
	if paymentMethod == "efectivo" {
		cashAmount = paidAmount
		transferAmount = 0
	} else if paymentMethod == "transferencia" {
		cashAmount = 0
		transferAmount = paidAmount
	} else if paymentMethod == "credito" {
		cashAmount = 0
		transferAmount = 0
	}

	for _, item := range resolved {
		rows, err := tx.Query(ctx, `SELECT ingredient_id, quantity_used FROM product_ingredients WHERE product_id = $1`, item.ProductID)
		if err == nil {
			for rows.Next() {
				var ingID uuid.UUID
				var qtyUsed float64
				if err := rows.Scan(&ingID, &qtyUsed); err == nil {
					needed := qtyUsed * float64(item.Quantity)
					tag, err := tx.Exec(ctx, `UPDATE ingredients SET quantity = quantity - $1 WHERE id = $2 AND quantity >= $1`, needed, ingID)
					if err != nil || tag.RowsAffected() == 0 {
						http.Error(w, "insumos insuficientes al actualizar la venta", http.StatusConflict)
						return
					}
				}
			}
			rows.Close()
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE sales
		SET customer_id = $1, customer_name = $2, payment_method = $3, cash_amount = $4, transfer_amount = $5,
		    bank_details = $6, subtotal = $7, discount_percent = $8, discount_amount = $9, discount_reason = $10, total = $11,
		    paid_amount = $12, pending_amount = $13, payment_status = $14
		WHERE id = $15
	`, req.CustomerID, customerName, paymentMethod, cashAmount, transferAmount, strings.TrimSpace(req.BankDetails), subtotal, discountPercent, discountAmount, strings.TrimSpace(req.DiscountReason), total, paidAmount, pendingAmount, paymentStatus, saleID)

	if err != nil {
		log.Printf("error actualizando venta: %v", err)
		if strings.Contains(strings.ToLower(err.Error()), "payment_method") || strings.Contains(strings.ToLower(err.Error()), "constraint") {
			_, _ = h.DB.Exec(ctx, `ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check`)
			_, _ = h.DB.Exec(ctx, `ALTER TABLE sales ALTER COLUMN payment_method TYPE VARCHAR(50)`)
			_, _ = h.DB.Exec(ctx, `
				DO $$ 
				DECLARE
					r RECORD;
				BEGIN
					FOR r IN (
						SELECT conname 
						FROM pg_constraint 
						WHERE conrelid = 'sales'::regclass 
						  AND contype = 'c' 
						  AND pg_get_constraintdef(oid) LIKE '%payment_method%'
					) LOOP
						EXECUTE 'ALTER TABLE sales DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
					END LOOP;
				END $$;
			`)
			_, err = tx.Exec(ctx, `
				UPDATE sales
				SET customer_id = $1, customer_name = $2, payment_method = $3, cash_amount = $4, transfer_amount = $5,
				    bank_details = $6, subtotal = $7, discount_percent = $8, discount_amount = $9, discount_reason = $10, total = $11,
				    paid_amount = $12, pending_amount = $13, payment_status = $14
				WHERE id = $15
			`, req.CustomerID, customerName, paymentMethod, cashAmount, transferAmount, strings.TrimSpace(req.BankDetails), subtotal, discountPercent, discountAmount, strings.TrimSpace(req.DiscountReason), total, paidAmount, pendingAmount, paymentStatus, saleID)
		}
		if err != nil {
			http.Error(w, fmt.Sprintf("error actualizando venta: %v", err), http.StatusInternalServerError)
			return
		}
	}

	_, _ = tx.Exec(ctx, `DELETE FROM sale_items WHERE sale_id = $1`, saleID)
	for _, item := range resolved {
		_, _ = tx.Exec(ctx, `
			INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price)
			VALUES ($1, $2, $3, $4, $5)
		`, saleID, item.ProductID, item.ProductName, item.Quantity, item.UnitPrice)
	}

	var comandaID uuid.UUID
	err = tx.QueryRow(ctx, `UPDATE comandas SET customer_name = $1 WHERE sale_id = $2 RETURNING id`, customerName, saleID).Scan(&comandaID)
	if err == nil {
		_, _ = tx.Exec(ctx, `DELETE FROM comanda_items WHERE comanda_id = $1`, comandaID)
		for _, item := range resolved {
			_, _ = tx.Exec(ctx, `
				INSERT INTO comanda_items (comanda_id, product_id, product_name, quantity, notes)
				VALUES ($1, $2, $3, $4, $5)
			`, comandaID, item.ProductID, item.ProductName, item.Quantity, item.Notes)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("error confirmando transacción: %v", err)
		http.Error(w, "error confirmando actualización", http.StatusInternalServerError)
		return
	}

	h.Hub.Publish("sale_updated", map[string]interface{}{
		"id":             saleID,
		"total":          total,
		"paid_amount":    paidAmount,
		"pending_amount": pendingAmount,
		"payment_status": paymentStatus,
	})
	if req.CustomerID != nil {
		var newDebt float64
		_ = h.DB.QueryRow(ctx, `SELECT COALESCE(SUM(pending_amount), 0) FROM sales WHERE customer_id = $1 AND status != 'cancelada'`, req.CustomerID).Scan(&newDebt)
		h.Hub.Publish("customer_updated", map[string]interface{}{
			"id":         req.CustomerID,
			"total_debt": newDebt,
		})
	}
	h.Hub.Publish("inventory_updated", map[string]interface{}{"action": "sale_edited"})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":              saleID,
		"customer_name":   customerName,
		"subtotal":        subtotal,
		"discount_amount": discountAmount,
		"total":           total,
		"paid_amount":     paidAmount,
		"pending_amount":  pendingAmount,
		"payment_status":  paymentStatus,
	})
}

// DELETE /sales/{id} — eliminación de venta (Exclusivo Owner)
func (h *SaleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	saleID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		log.Printf("error iniciando transacción: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var customerID *uuid.UUID
	_ = tx.QueryRow(ctx, `SELECT customer_id FROM sales WHERE id = $1`, saleID).Scan(&customerID)

	var status string
	_ = tx.QueryRow(ctx, `SELECT COALESCE(status, 'completada') FROM comandas WHERE sale_id = $1`, saleID).Scan(&status)

	if status != "cancelado" && status != "cancelada" {
		rows, err := tx.Query(ctx, `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`, saleID)
		if err == nil {
			type ip struct {
				pid uuid.UUID
				qty int
			}
			var items []ip
			for rows.Next() {
				var i ip
				if err := rows.Scan(&i.pid, &i.qty); err == nil {
					items = append(items, i)
				}
			}
			rows.Close()

			for _, item := range items {
				recRows, err := tx.Query(ctx, `SELECT ingredient_id, quantity_used FROM product_ingredients WHERE product_id = $1`, item.pid)
				if err == nil {
					for recRows.Next() {
						var ingID uuid.UUID
						var qUsed float64
						if err := recRows.Scan(&ingID, &qUsed); err == nil {
							toReturn := qUsed * float64(item.qty)
							_, _ = tx.Exec(ctx, `UPDATE ingredients SET quantity = quantity + $1 WHERE id = $2`, toReturn, ingID)
						}
					}
					recRows.Close()
				}
			}
		}
	}

	_, _ = tx.Exec(ctx, `DELETE FROM comandas WHERE sale_id = $1`, saleID)
	_, _ = tx.Exec(ctx, `DELETE FROM sale_items WHERE sale_id = $1`, saleID)
	tag, err := tx.Exec(ctx, `DELETE FROM sales WHERE id = $1`, saleID)
	if err != nil {
		log.Printf("error eliminando venta: %v", err)
		http.Error(w, "error eliminando venta", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "venta no encontrada", http.StatusNotFound)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("error confirmando eliminación: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}

	if customerID != nil {
		var newDebt float64
		_ = h.DB.QueryRow(r.Context(), `SELECT COALESCE(SUM(pending_amount), 0) FROM sales WHERE customer_id = $1 AND status != 'cancelada'`, customerID).Scan(&newDebt)
		h.Hub.Publish("customer_updated", map[string]interface{}{
			"id":         customerID,
			"total_debt": newDebt,
		})
	}

	h.Hub.Publish("sale_deleted", map[string]string{"id": idStr})
	h.Hub.Publish("inventory_updated", map[string]interface{}{"action": "sale_deleted"})

	w.WriteHeader(http.StatusNoContent)
}
