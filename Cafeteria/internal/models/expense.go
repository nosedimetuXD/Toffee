package models

import (
	"time"

	"github.com/google/uuid"
)

type Expense struct {
	ID             uuid.UUID  `json:"id"`
	Description    string     `json:"description"`
	Amount         float64    `json:"amount"`
	Category       string     `json:"category"`
	PaymentMethod  string     `json:"payment_method"`
	RegisteredBy   uuid.UUID  `json:"registered_by"`
	RegistererName string     `json:"registerer_name,omitempty"`
	IngredientID   *uuid.UUID `json:"ingredient_id,omitempty"`
	IngredientName string     `json:"ingredient_name,omitempty"`
	QuantityAdded  float64    `json:"quantity_added,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type Income struct {
	ID             uuid.UUID  `json:"id"`
	Type           string     `json:"type"` // "sale" or "manual"
	Description    string     `json:"description"`
	Amount         float64    `json:"amount"`
	Category       string     `json:"category"`
	PaymentMethod  string     `json:"payment_method"`
	BankDetails    string     `json:"bank_details,omitempty"`
	CustomerName   string     `json:"customer_name,omitempty"`
	RegisteredBy   *uuid.UUID `json:"registered_by,omitempty"`
	RegistererName string     `json:"registerer_name,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type CustomerStat struct {
	CustomerName string  `json:"customer_name"`
	TotalSpent   float64 `json:"total_spent"`
	OrdersCount  int     `json:"orders_count"`
}

type TopSellerStat struct {
	Username    string  `json:"username"`
	Role        string  `json:"role"`
	TotalAmount float64 `json:"total_amount"`
	SalesCount  int     `json:"sales_count"`
}

type TopProductStat struct {
	ProductName string  `json:"product_name"`
	TotalQty    int     `json:"total_qty"`
	TotalAmount float64 `json:"total_amount"`
}

type TopBankStat struct {
	BankName    string  `json:"bank_name"`
	Count       int     `json:"count"`
	TotalAmount float64 `json:"total_amount"`
}

type MonthlyStats struct {
	MonthlyIncome      float64          `json:"monthly_income"`
	MonthlyExpenses    float64          `json:"monthly_expenses"`
	NetProfit          float64          `json:"net_profit"`
	AvgPrepTimeMinutes float64          `json:"avg_prep_time_minutes"`
	TopSeller          *TopSellerStat   `json:"top_seller"`
	TopProduct         *TopProductStat  `json:"top_product"`
	TopProducts        []TopProductStat `json:"top_products"`
	TopCustomers       []CustomerStat   `json:"top_customers"`
	TopBanks           []TopBankStat    `json:"top_banks"`
}

type AccountingSummary struct {
	TotalIncome           float64            `json:"total_income"`
	TotalExpenses         float64            `json:"total_expenses"`
	NetBalance            float64            `json:"net_balance"`
	IncomeByPaymentMethod map[string]float64 `json:"income_by_payment_method"`
	ExpensesByCategory    map[string]float64 `json:"expenses_by_category"`
	SalesCount            int                `json:"sales_count"`
	IncomesCount          int                `json:"incomes_count"`
	ExpensesCount         int                `json:"expenses_count"`
	MonthlyStats          *MonthlyStats      `json:"monthly_stats,omitempty"`
}
