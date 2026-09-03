package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NosedimetuXD/cafeteria/internal/events"
	custommw "github.com/NosedimetuXD/cafeteria/internal/middleware"
	"github.com/NosedimetuXD/cafeteria/internal/models"
)

type AccountingHandler struct {
	DB  *pgxpool.Pool
	Hub *events.Hub
}

func NewAccountingHandler(db *pgxpool.Pool, hub *events.Hub) *AccountingHandler {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, _ = db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS incomes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			description TEXT NOT NULL,
			amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
			category VARCHAR(50) NOT NULL DEFAULT 'otros',
			payment_method VARCHAR(255) NOT NULL DEFAULT 'efectivo',
			registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS idx_incomes_created_at ON incomes(created_at DESC);
	`)

	return &AccountingHandler{DB: db, Hub: hub}
}

// GET /accounting/summary?period=today|week|month|all&start_date=...&end_date=...&year=...&month_num=...
func (h *AccountingHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	startDate := strings.TrimSpace(r.URL.Query().Get("start_date"))
	endDate := strings.TrimSpace(r.URL.Query().Get("end_date"))
	yearParam := strings.TrimSpace(r.URL.Query().Get("year"))
	monthParam := strings.TrimSpace(r.URL.Query().Get("month_num"))

	var timeCondition string
	var timeCondSales string
	var timeCondComandas string

	if startDate != "" && endDate != "" {
		timeCondition = fmt.Sprintf("created_at >= '%s 00:00:00' AND created_at <= '%s 23:59:59'", startDate, endDate)
		timeCondSales = fmt.Sprintf("s.created_at >= '%s 00:00:00' AND s.created_at <= '%s 23:59:59'", startDate, endDate)
		timeCondComandas = fmt.Sprintf("c.created_at >= '%s 00:00:00' AND c.created_at <= '%s 23:59:59'", startDate, endDate)
	} else if yearParam != "" && monthParam != "" {
		y, _ := strconv.Atoi(yearParam)
		m, _ := strconv.Atoi(monthParam)
		if y > 2000 && m >= 1 && m <= 12 {
			timeCondition = fmt.Sprintf("EXTRACT(YEAR FROM created_at) = %d AND EXTRACT(MONTH FROM created_at) = %d", y, m)
			timeCondSales = fmt.Sprintf("EXTRACT(YEAR FROM s.created_at) = %d AND EXTRACT(MONTH FROM s.created_at) = %d", y, m)
			timeCondComandas = fmt.Sprintf("EXTRACT(YEAR FROM c.created_at) = %d AND EXTRACT(MONTH FROM c.created_at) = %d", y, m)
		}
	}

	if timeCondition == "" {
		switch period {
		case "today":
			timeCondition = "(created_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date"
			timeCondSales = "(s.created_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date"
			timeCondComandas = "(c.created_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date"
		case "week":
			timeCondition = "created_at >= (now() - INTERVAL '7 days')"
			timeCondSales = "s.created_at >= (now() - INTERVAL '7 days')"
			timeCondComandas = "c.created_at >= (now() - INTERVAL '7 days')"
		case "month":
			timeCondition = "created_at >= date_trunc('month', now())"
			timeCondSales = "s.created_at >= date_trunc('month', now())"
			timeCondComandas = "c.created_at >= date_trunc('month', now())"
		case "prev_month":
			timeCondition = "created_at >= date_trunc('month', now() - INTERVAL '1 month') AND created_at < date_trunc('month', now())"
			timeCondSales = "s.created_at >= date_trunc('month', now() - INTERVAL '1 month') AND s.created_at < date_trunc('month', now())"
			timeCondComandas = "c.created_at >= date_trunc('month', now() - INTERVAL '1 month') AND c.created_at < date_trunc('month', now())"
		case "year":
			timeCondition = "created_at >= date_trunc('year', now())"
			timeCondSales = "s.created_at >= date_trunc('year', now())"
			timeCondComandas = "c.created_at >= date_trunc('year', now())"
		default: // "all"
			timeCondition = "1=1"
			timeCondSales = "1=1"
			timeCondComandas = "1=1"
		}
	}

	summary := models.AccountingSummary{
		IncomeByPaymentMethod: make(map[string]float64),
		ExpensesByCategory:   make(map[string]float64),
	}

	var cashIncome, transferIncome float64
	salesQuery := "SELECT COALESCE(SUM(s.total), 0), COUNT(s.id), COALESCE(SUM(s.cash_amount), 0), COALESCE(SUM(s.transfer_amount), 0) FROM sales s LEFT JOIN comandas c ON c.sale_id = s.id WHERE (c.status IS NULL OR c.status != 'cancelado') AND " + timeCondSales
	err := h.DB.QueryRow(r.Context(), salesQuery).Scan(&summary.TotalIncome, &summary.SalesCount, &cashIncome, &transferIncome)
	if err != nil {
		log.Printf("error calculando ingresos: %v", err)
		http.Error(w, "error calculando ingresos", http.StatusInternalServerError)
		return
	}
	summary.IncomeByPaymentMethod["efectivo"] = cashIncome
	summary.IncomeByPaymentMethod["transferencia"] = transferIncome

	expensesQuery := "SELECT COALESCE(SUM(amount), 0), COUNT(id) FROM expenses WHERE " + timeCondition
	err = h.DB.QueryRow(r.Context(), expensesQuery).Scan(&summary.TotalExpenses, &summary.ExpensesCount)
	if err != nil {
		log.Printf("error calculando gastos: %v", err)
		http.Error(w, "error calculando gastos", http.StatusInternalServerError)
		return
	}

	catQuery := "SELECT category, COALESCE(SUM(amount), 0) FROM expenses WHERE " + timeCondition + " GROUP BY category"
	rows, err := h.DB.Query(r.Context(), catQuery)
	if err == nil {
		for rows.Next() {
			var cat string
			var amount float64
			if err := rows.Scan(&cat, &amount); err == nil {
				summary.ExpensesByCategory[cat] = amount
			}
		}
		rows.Close()
	}

	summary.NetBalance = summary.TotalIncome - summary.TotalExpenses

	roleVal := r.Context().Value(custommw.ContextRole)
	var userRole models.UserRole
	if r, ok := roleVal.(models.UserRole); ok {
		userRole = r
	} else if rStr, ok := roleVal.(string); ok {
		userRole = models.UserRole(rStr)
	}

	if userRole == models.RoleOwner || string(userRole) == "dueño" {
		mStats := &models.MonthlyStats{
			TopCustomers: []models.CustomerStat{},
			TopProducts:  []models.TopProductStat{},
			TopBanks:     []models.TopBankStat{},
		}

		_ = h.DB.QueryRow(r.Context(),
			"SELECT COALESCE(SUM(s.total), 0) FROM sales s LEFT JOIN comandas c ON c.sale_id = s.id WHERE (c.status IS NULL OR c.status != 'cancelado') AND "+timeCondSales).Scan(&mStats.MonthlyIncome)

		_ = h.DB.QueryRow(r.Context(),
			"SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE "+timeCondition).Scan(&mStats.MonthlyExpenses)

		mStats.NetProfit = mStats.MonthlyIncome - mStats.MonthlyExpenses

		_ = h.DB.QueryRow(r.Context(),
			"SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(c.ready_at, c.updated_at) - c.created_at))/60), 0) FROM comandas c WHERE c.status IN ('listo', 'entregado') AND "+timeCondComandas).Scan(&mStats.AvgPrepTimeMinutes)

		var topSeller models.TopSellerStat
		errSeller := h.DB.QueryRow(r.Context(),
			`SELECT u.username, u.role, COALESCE(SUM(s.total), 0) as total_amount, COUNT(s.id) as sales_count
			 FROM sales s
			 JOIN users u ON s.sold_by = u.id
			 LEFT JOIN comandas c ON c.sale_id = s.id
			 WHERE (c.status IS NULL OR c.status != 'cancelado') AND `+timeCondSales+`
			 GROUP BY u.id, u.username, u.role
			 ORDER BY total_amount DESC
			 LIMIT 1`).Scan(&topSeller.Username, &topSeller.Role, &topSeller.TotalAmount, &topSeller.SalesCount)
		if errSeller == nil {
			mStats.TopSeller = &topSeller
		}

		prodRows, errProdList := h.DB.Query(r.Context(),
			`SELECT COALESCE(NULLIF(si.product_name, ''), p.name, 'Producto Eliminado') as prod_name,
			        COALESCE(SUM(si.quantity), 0) as total_qty, 
			        COALESCE(SUM(si.quantity * si.unit_price), 0) as total_amount
			 FROM sale_items si
			 JOIN sales s ON si.sale_id = s.id
			 LEFT JOIN comandas c ON c.sale_id = s.id
			 LEFT JOIN products p ON si.product_id = p.id
			 WHERE (c.status IS NULL OR c.status != 'cancelado') AND `+timeCondSales+`
			 GROUP BY COALESCE(NULLIF(si.product_name, ''), p.name, 'Producto Eliminado')
			 ORDER BY total_qty DESC
			 LIMIT 10`)
		if errProdList == nil {
			for prodRows.Next() {
				var tp models.TopProductStat
				if err := prodRows.Scan(&tp.ProductName, &tp.TotalQty, &tp.TotalAmount); err == nil {
					mStats.TopProducts = append(mStats.TopProducts, tp)
				}
			}
			prodRows.Close()
		}
		if len(mStats.TopProducts) > 0 {
			mStats.TopProduct = &mStats.TopProducts[0]
		}

		custRows, errCust := h.DB.Query(r.Context(),
			`SELECT s.customer_name, COALESCE(SUM(s.total), 0) as total_spent, COUNT(s.id) as orders_count
			 FROM sales s
			 LEFT JOIN comandas c ON c.sale_id = s.id
			 WHERE (c.status IS NULL OR c.status != 'cancelado') AND `+timeCondSales+` AND TRIM(s.customer_name) != '' AND LOWER(s.customer_name) != 'cliente general'
			 GROUP BY s.customer_name
			 ORDER BY total_spent DESC
			 LIMIT 10`)
		if errCust == nil {
			for custRows.Next() {
				var cs models.CustomerStat
				if err := custRows.Scan(&cs.CustomerName, &cs.TotalSpent, &cs.OrdersCount); err == nil {
					mStats.TopCustomers = append(mStats.TopCustomers, cs)
				}
			}
			custRows.Close()
		}

		bankRows, errBank := h.DB.Query(r.Context(),
			`SELECT 
				COALESCE(NULLIF(TRIM(s.bank_details), ''), 'Transferencia General') as bank_name,
				COUNT(s.id) as count,
				COALESCE(SUM(CASE WHEN s.transfer_amount > 0 THEN s.transfer_amount ELSE s.total END), 0) as total_amount
			 FROM sales s
			 LEFT JOIN comandas c ON c.sale_id = s.id
			 WHERE (c.status IS NULL OR c.status != 'cancelado') AND `+timeCondSales+` 
			   AND (s.payment_method IN ('transferencia', 'mixto', 'multibanco') OR s.transfer_amount > 0)
			 GROUP BY bank_name
			 ORDER BY count DESC, total_amount DESC
			 LIMIT 5`)
		if errBank == nil {
			for bankRows.Next() {
				var tb models.TopBankStat
				if err := bankRows.Scan(&tb.BankName, &tb.Count, &tb.TotalAmount); err == nil {
					mStats.TopBanks = append(mStats.TopBanks, tb)
				}
			}
			bankRows.Close()
		}

		summary.MonthlyStats = mStats
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

// GET /expenses?period=today|week|month|all&start_date=...&end_date=...
func (h *AccountingHandler) ListExpenses(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	startDate := strings.TrimSpace(r.URL.Query().Get("start_date"))
	endDate := strings.TrimSpace(r.URL.Query().Get("end_date"))

	var timeCondition string
	if startDate != "" && endDate != "" {
		timeCondition = fmt.Sprintf("WHERE e.created_at >= '%s 00:00:00' AND e.created_at <= '%s 23:59:59'", startDate, endDate)
	} else {
		switch period {
		case "today":
			timeCondition = "WHERE (e.created_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date"
		case "week":
			timeCondition = "WHERE e.created_at >= (now() - INTERVAL '7 days')"
		case "month":
			timeCondition = "WHERE e.created_at >= date_trunc('month', now())"
		case "prev_month":
			timeCondition = "WHERE e.created_at >= date_trunc('month', now() - INTERVAL '1 month') AND e.created_at < date_trunc('month', now())"
		case "year":
			timeCondition = "WHERE e.created_at >= date_trunc('year', now())"
		default: // "all"
			timeCondition = ""
		}
	}

	query := fmt.Sprintf(`SELECT e.id, e.description, e.amount, e.category, e.payment_method, e.registered_by, 
		        COALESCE(u.username, 'Personal'), e.ingredient_id, COALESCE(i.name, ''), e.quantity_added, e.created_at 
		 FROM expenses e
		 LEFT JOIN users u ON e.registered_by = u.id
		 LEFT JOIN ingredients i ON e.ingredient_id = i.id
		 %s
		 ORDER BY e.created_at DESC`, timeCondition)

	rows, err := h.DB.Query(r.Context(), query)
	if err != nil {
		log.Printf("error consultando gastos: %v", err)
		http.Error(w, "error consultando gastos", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var expenses []models.Expense
	for rows.Next() {
		var e models.Expense
		if err := rows.Scan(&e.ID, &e.Description, &e.Amount, &e.Category, &e.PaymentMethod,
			&e.RegisteredBy, &e.RegistererName, &e.IngredientID, &e.IngredientName, &e.QuantityAdded, &e.CreatedAt); err != nil {
			log.Printf("error leyendo gastos: %v", err)
			http.Error(w, "error leyendo gastos", http.StatusInternalServerError)
			return
		}
		expenses = append(expenses, e)
	}

	if expenses == nil {
		expenses = []models.Expense{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(expenses)
}

type createExpenseRequest struct {
	Description   string     `json:"description"`
	Amount        float64    `json:"amount"`
	Category      string     `json:"category"`
	PaymentMethod string     `json:"payment_method"`
	IngredientID  *uuid.UUID `json:"ingredient_id,omitempty"`
	QuantityAdded float64    `json:"quantity_added,omitempty"`
	CreatedAt     string     `json:"created_at,omitempty"`
}

// POST /expenses
func (h *AccountingHandler) CreateExpense(w http.ResponseWriter, r *http.Request) {
	var req createExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}

	desc := strings.TrimSpace(req.Description)
	if desc == "" || req.Amount <= 0 {
		http.Error(w, "descripción y monto válido son requeridos", http.StatusBadRequest)
		return
	}

	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" {
		category = "otros"
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "efectivo"
	}

	ctx := r.Context()
	userVal := ctx.Value(custommw.ContextUserID)
	var registeredBy uuid.UUID
	if userVal != nil {
		if id, ok := userVal.(uuid.UUID); ok {
			registeredBy = id
		} else if idStr, ok := userVal.(string); ok {
			registeredBy, _ = uuid.Parse(idStr)
		}
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		log.Printf("error iniciando transacción: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	if req.IngredientID != nil && req.QuantityAdded > 0 {
		tag, err := tx.Exec(ctx,
			`UPDATE ingredients SET quantity = quantity + $1, updated_at = now() WHERE id = $2`,
			req.QuantityAdded, *req.IngredientID)
		if err != nil {
			log.Printf("error reabasteciendo inventario: %v", err)
			http.Error(w, "error reabasteciendo insumo", http.StatusInternalServerError)
			return
		}
		if tag.RowsAffected() == 0 {
			http.Error(w, "el insumo especificado no existe", http.StatusBadRequest)
			return
		}
	}

	var expID uuid.UUID
	var createdAt time.Time

	if req.CreatedAt != "" {
		parsedDate, err := time.Parse(time.RFC3339, req.CreatedAt)
		if err == nil {
			err = tx.QueryRow(ctx,
				`INSERT INTO expenses (description, amount, category, payment_method, registered_by, ingredient_id, quantity_added, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
				desc, req.Amount, category, paymentMethod, registeredBy, req.IngredientID, req.QuantityAdded, parsedDate,
			).Scan(&expID, &createdAt)
		}
	}

	if expID == uuid.Nil {
		err = tx.QueryRow(ctx,
			`INSERT INTO expenses (description, amount, category, payment_method, registered_by, ingredient_id, quantity_added, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id, created_at`,
			desc, req.Amount, category, paymentMethod, registeredBy, req.IngredientID, req.QuantityAdded,
		).Scan(&expID, &createdAt)
	}

	if err != nil {
		log.Printf("error creando gasto: %v", err)
		http.Error(w, "error registrando gasto", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("error confirmando transacción de gasto: %v", err)
		http.Error(w, "error interno", http.StatusInternalServerError)
		return
	}

	h.Hub.Publish("expense_created", map[string]interface{}{
		"id":          expID,
		"description": desc,
		"amount":      req.Amount,
		"category":    category,
	})

	if req.IngredientID != nil && req.QuantityAdded > 0 {
		h.Hub.Publish("inventory_updated", map[string]interface{}{
			"ingredient_id":  *req.IngredientID,
			"quantity_added": req.QuantityAdded,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         expID,
		"created_at": createdAt,
	})
}

// PUT /expenses/{id} — edición de gasto (Exclusivo Owner)
func (h *AccountingHandler) UpdateExpense(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	expID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var req createExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}

	desc := strings.TrimSpace(req.Description)
	if desc == "" || req.Amount <= 0 {
		http.Error(w, "descripción y monto válido son requeridos", http.StatusBadRequest)
		return
	}

	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" {
		category = "otros"
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "efectivo"
	}

	var parsedDate *time.Time
	if req.CreatedAt != "" {
		if t, err := time.Parse(time.RFC3339, req.CreatedAt); err == nil {
			parsedDate = &t
		}
	}

	var errUpd error
	if parsedDate != nil {
		_, errUpd = h.DB.Exec(r.Context(),
			`UPDATE expenses SET description = $1, amount = $2, category = $3, payment_method = $4, created_at = $5 WHERE id = $6`,
			desc, req.Amount, category, paymentMethod, *parsedDate, expID)
	} else {
		_, errUpd = h.DB.Exec(r.Context(),
			`UPDATE expenses SET description = $1, amount = $2, category = $3, payment_method = $4 WHERE id = $5`,
			desc, req.Amount, category, paymentMethod, expID)
	}

	if errUpd != nil {
		log.Printf("error actualizando gasto: %v", errUpd)
		http.Error(w, "error actualizando gasto", http.StatusInternalServerError)
		return
	}

	h.Hub.Publish("expense_updated", map[string]interface{}{"id": expID})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": expID, "status": "updated"})
}

// DELETE /expenses/{id} — eliminación de gasto (Exclusivo Owner)
func (h *AccountingHandler) DeleteExpense(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	expID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	tag, err := h.DB.Exec(r.Context(), `DELETE FROM expenses WHERE id = $1`, expID)
	if err != nil {
		log.Printf("error eliminando gasto: %v", err)
		http.Error(w, "error eliminando gasto", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "gasto no encontrado", http.StatusNotFound)
		return
	}

	h.Hub.Publish("expense_deleted", map[string]string{"id": idStr})
	w.WriteHeader(http.StatusNoContent)
}

// GET /incomes?period=today|week|month|all&start_date=...&end_date=...
func (h *AccountingHandler) ListIncomes(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	startDate := strings.TrimSpace(r.URL.Query().Get("start_date"))
	endDate := strings.TrimSpace(r.URL.Query().Get("end_date"))

	var timeCondition string
	if startDate != "" && endDate != "" {
		timeCondition = fmt.Sprintf("WHERE i.created_at >= '%s 00:00:00' AND i.created_at <= '%s 23:59:59'", startDate, endDate)
	} else {
		switch period {
		case "today":
			timeCondition = "WHERE (i.created_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date"
		case "week":
			timeCondition = "WHERE i.created_at >= (now() - INTERVAL '7 days')"
		case "month":
			timeCondition = "WHERE i.created_at >= date_trunc('month', now())"
		case "prev_month":
			timeCondition = "WHERE i.created_at >= date_trunc('month', now() - INTERVAL '1 month') AND i.created_at < date_trunc('month', now())"
		case "year":
			timeCondition = "WHERE i.created_at >= date_trunc('year', now())"
		default: // "all"
			timeCondition = ""
		}
	}

	query := fmt.Sprintf(`SELECT i.id, i.description, i.amount, i.category, i.payment_method, i.registered_by, 
		        COALESCE(u.username, 'Personal'), i.created_at 
		 FROM incomes i
		 LEFT JOIN users u ON i.registered_by = u.id
		 %s
		 ORDER BY i.created_at DESC`, timeCondition)

	rows, err := h.DB.Query(r.Context(), query)
	if err != nil {
		log.Printf("error consultando ingresos manuales: %v", err)
		http.Error(w, "error consultando ingresos", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var incomes []models.Income
	for rows.Next() {
		var inc models.Income
		if err := rows.Scan(&inc.ID, &inc.Description, &inc.Amount, &inc.Category, &inc.PaymentMethod,
			&inc.RegisteredBy, &inc.RegistererName, &inc.CreatedAt); err != nil {
			log.Printf("error leyendo ingresos: %v", err)
			http.Error(w, "error leyendo ingresos", http.StatusInternalServerError)
			return
		}
		incomes = append(incomes, inc)
	}

	if incomes == nil {
		incomes = []models.Income{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(incomes)
}

type createIncomeRequest struct {
	Description   string  `json:"description"`
	Amount        float64 `json:"amount"`
	Category      string  `json:"category"`
	PaymentMethod string  `json:"payment_method"`
	CreatedAt     string  `json:"created_at,omitempty"`
}

// POST /incomes
func (h *AccountingHandler) CreateIncome(w http.ResponseWriter, r *http.Request) {
	var req createIncomeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}

	desc := strings.TrimSpace(req.Description)
	if desc == "" || req.Amount <= 0 {
		http.Error(w, "descripción y monto válido son requeridos", http.StatusBadRequest)
		return
	}

	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" {
		category = "otros"
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "efectivo"
	}

	ctx := r.Context()
	userVal := ctx.Value(custommw.ContextUserID)
	var registeredBy uuid.UUID
	if userVal != nil {
		if id, ok := userVal.(uuid.UUID); ok {
			registeredBy = id
		} else if idStr, ok := userVal.(string); ok {
			registeredBy, _ = uuid.Parse(idStr)
		}
	}

	var incID uuid.UUID
	var createdAt time.Time

	if req.CreatedAt != "" {
		parsedDate, err := time.Parse(time.RFC3339, req.CreatedAt)
		if err == nil {
			err = h.DB.QueryRow(ctx,
				`INSERT INTO incomes (description, amount, category, payment_method, registered_by, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
				desc, req.Amount, category, paymentMethod, registeredBy, parsedDate,
			).Scan(&incID, &createdAt)
		}
	}

	if incID == uuid.Nil {
		err := h.DB.QueryRow(ctx,
			`INSERT INTO incomes (description, amount, category, payment_method, registered_by, created_at)
			 VALUES ($1, $2, $3, $4, $5, now()) RETURNING id, created_at`,
			desc, req.Amount, category, paymentMethod, registeredBy,
		).Scan(&incID, &createdAt)
		if err != nil {
			log.Printf("error creando ingreso manual: %v", err)
			http.Error(w, "error registrando ingreso", http.StatusInternalServerError)
			return
		}
	}

	h.Hub.Publish("income_created", map[string]interface{}{
		"id":          incID,
		"description": desc,
		"amount":      req.Amount,
		"category":    category,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         incID,
		"created_at": createdAt,
	})
}

// PUT /incomes/{id} — edición de ingreso (Exclusivo Owner)
func (h *AccountingHandler) UpdateIncome(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	incID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var req createIncomeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}

	desc := strings.TrimSpace(req.Description)
	if desc == "" || req.Amount <= 0 {
		http.Error(w, "descripción y monto válido son requeridos", http.StatusBadRequest)
		return
	}

	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" {
		category = "otros"
	}

	paymentMethod := strings.ToLower(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "efectivo"
	}

	var parsedDate *time.Time
	if req.CreatedAt != "" {
		if t, err := time.Parse(time.RFC3339, req.CreatedAt); err == nil {
			parsedDate = &t
		}
	}

	var errUpd error
	if parsedDate != nil {
		_, errUpd = h.DB.Exec(r.Context(),
			`UPDATE incomes SET description = $1, amount = $2, category = $3, payment_method = $4, created_at = $5 WHERE id = $6`,
			desc, req.Amount, category, paymentMethod, *parsedDate, incID)
	} else {
		_, errUpd = h.DB.Exec(r.Context(),
			`UPDATE incomes SET description = $1, amount = $2, category = $3, payment_method = $4 WHERE id = $5`,
			desc, req.Amount, category, paymentMethod, incID)
	}

	if errUpd != nil {
		log.Printf("error actualizando ingreso: %v", errUpd)
		http.Error(w, "error actualizando ingreso", http.StatusInternalServerError)
		return
	}

	h.Hub.Publish("income_updated", map[string]interface{}{"id": incID})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": incID, "status": "updated"})
}

// DELETE /incomes/{id} — eliminación de ingreso (Exclusivo Owner)
func (h *AccountingHandler) DeleteIncome(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	incID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	tag, err := h.DB.Exec(r.Context(), `DELETE FROM incomes WHERE id = $1`, incID)
	if err != nil {
		log.Printf("error eliminando ingreso: %v", err)
		http.Error(w, "error eliminando ingreso", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "ingreso no encontrado", http.StatusNotFound)
		return
	}

	h.Hub.Publish("income_deleted", map[string]string{"id": idStr})
	w.WriteHeader(http.StatusNoContent)
}
