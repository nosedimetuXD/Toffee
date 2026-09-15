package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/cors"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/NosedimetuXD/cafeteria/internal/db"
	"github.com/NosedimetuXD/cafeteria/internal/events"
	"github.com/NosedimetuXD/cafeteria/internal/handlers"
	custommw "github.com/NosedimetuXD/cafeteria/internal/middleware"
	"github.com/NosedimetuXD/cafeteria/internal/models"
)

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println("no se encontró .env, usando variables de entorno del sistema")
	}

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) < 32 {
		if os.Getenv("ENV") == "production" || os.Getenv("ENVIRONMENT") == "production" {
			log.Fatalf("error fatal: JWT_SECRET es obligatoria y debe tener al menos 32 caracteres")
		} else {
			log.Println("ADVERTENCIA: JWT_SECRET no está configurada o tiene menos de 32 caracteres")
		}
	}

	ctx := context.Background()

	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("no se pudo conectar a la base de datos: %v", err)
	}
	defer pool.Close()

	hub := events.NewHub()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Security Headers Middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			next.ServeHTTP(w, r)
		})
	})

	defaultOrigins := []string{
		"https://toffee-udc.vercel.app",
		"https://toffee-test-eight.vercel.app",
		"https://toffee.vercel.app",
		"https://toffe-test.vercel.app",
		"http://localhost:5173",
		"http://localhost:3000",
		"http://localhost:8080",
		"http://127.0.0.1:5173",
	}

	allowedOriginsMap := make(map[string]bool)
	for _, o := range defaultOrigins {
		allowedOriginsMap[o] = true
	}

	allowedOriginsEnv := os.Getenv("ALLOWED_ORIGINS")
	if allowedOriginsEnv != "" {
		for _, o := range strings.Split(allowedOriginsEnv, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				allowedOriginsMap[trimmed] = true
			}
		}
	}

	var allowedOrigins []string
	for o := range allowedOriginsMap {
		allowedOrigins = append(allowedOrigins, o)
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization", "X-Requested-With"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	authHandler := handlers.NewAuthHandler(pool)
	// Rate limiting: máx 10 peticiones por minuto por IP en /login contra fuerza bruta
	r.With(custommw.RateLimit(10, time.Minute)).Post("/login", authHandler.Login)

	productHandler := handlers.NewProductHandler(pool)
	ingredientHandler := handlers.NewIngredientHandler(pool, hub)
	saleHandler := handlers.NewSaleHandler(pool, hub)
	taskHandler := handlers.NewTaskHandler(pool, hub)
	recipeHandler := handlers.NewRecipeHandler(pool)
	eventHandler := handlers.NewEventHandler(hub)
	userHandler := handlers.NewUserHandler(pool)
	comandaHandler := handlers.NewComandaHandler(pool, hub)
	accountingHandler := handlers.NewAccountingHandler(pool, hub)
	wasteHandler := handlers.NewWasteHandler(pool, hub)
	customerHandler := handlers.NewCustomerHandler(pool, hub)

	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuthSSE)
		r.Get("/events", eventHandler.Stream)
	})

	// Lectura & Operación común: cualquier usuario logueado, sin importar el rol
	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuth)
		r.Get("/products", productHandler.List)
		r.Get("/products/{id}", productHandler.Get)
		r.Get("/ingredients", ingredientHandler.List)
		r.Get("/ingredients/{id}", ingredientHandler.Get)
		r.Get("/products/{id}/recipe", recipeHandler.Get)
		r.Get("/users", userHandler.List)
		r.Put("/users/me", userHandler.UpdateSelf)
		r.Get("/waste", wasteHandler.List)
		r.Post("/waste", wasteHandler.Create)

		// CRM de Clientes accesible para todos los usuarios
		r.Get("/customers", customerHandler.List)
		r.Get("/customers/{id}", customerHandler.Get)
		r.Get("/customers/{id}/account", customerHandler.GetAccount)
		r.Post("/customers/{id}/payments", customerHandler.CreatePayment)
		r.Post("/customers", customerHandler.Create)
		r.Put("/customers/{id}", customerHandler.Update)

		// Cancelación de ventas y comandas: accesible para cualquier rol
		r.Post("/sales/{id}/cancel", comandaHandler.CancelComanda)
		r.Post("/comandas/{id}/cancel", comandaHandler.CancelComanda)
		r.Patch("/comandas/{id}/cancel", comandaHandler.CancelComanda)
	})

	// Crear/editar/borrar productos y recetas: solo owner y admin
	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuth)
		r.Use(custommw.RequireRole(models.RoleOwner, models.RoleAdmin))
		r.Post("/products", productHandler.Create)
		r.Put("/products/{id}", productHandler.Update)
		r.Delete("/products/{id}", productHandler.Delete)
		r.Put("/products/{id}/recipe", recipeHandler.Set)
	})

	// Gestión de usuarios y operaciones críticas de cliente: solo el Dueño (Owner)
	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuth)
		r.Use(custommw.RequireRole(models.RoleOwner))
		r.Post("/users", userHandler.Create)
		r.Put("/users/{id}", userHandler.Update)
		r.Delete("/users/{id}", userHandler.Delete)
		r.Delete("/customers/{id}", customerHandler.Delete)
	})

	// Modificar inventario directamente: solo dueño y admin
	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuth)
		r.Use(custommw.RequireRole(models.RoleOwner, models.RoleAdmin))
		r.Post("/ingredients", ingredientHandler.Create)
		r.Put("/ingredients/{id}", ingredientHandler.Update)
		r.Delete("/ingredients/{id}", ingredientHandler.Delete)
	})

	// Comandas: cualquier usuario logueado puede verlas y actualizar su estado
	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuth)
		r.Get("/comandas", comandaHandler.List)
		r.Patch("/comandas/{id}/status", comandaHandler.UpdateStatus)
	})

	// Ver tareas y cambiar su propio estado: cualquier usuario logueado
	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuth)
		r.Get("/tasks", taskHandler.List)
		r.Patch("/tasks/{id}/status", taskHandler.UpdateStatus)
	})

	// Crear, editar y borrar tareas: solo owner y admin
	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuth)
		r.Use(custommw.RequireRole(models.RoleOwner, models.RoleAdmin))
		r.Post("/tasks", taskHandler.Create)
		r.Put("/tasks/{id}", taskHandler.Update)
		r.Delete("/tasks/{id}", taskHandler.Delete)
	})

	// Ventas: cualquier rol puede vender y listar
	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuth)
		r.Use(custommw.RequireRole(models.RoleOwner, models.RoleAdmin, models.RoleEmployee))
		r.Get("/sales", saleHandler.List)
		r.Get("/sales/{id}", saleHandler.Get)
		r.Post("/sales", saleHandler.Create)
	})

	// Edición/eliminación de ventas, Contabilidad y Gastos: solo el Dueño (Owner)
	r.Group(func(r chi.Router) {
		r.Use(custommw.RequireAuth)
		r.Use(custommw.RequireRole(models.RoleOwner))
		r.Put("/sales/{id}", saleHandler.Update)
		r.Delete("/sales/{id}", saleHandler.Delete)

		r.Get("/accounting/summary", accountingHandler.GetSummary)
		r.Get("/expenses", accountingHandler.ListExpenses)
		r.Post("/expenses", accountingHandler.CreateExpense)
		r.Put("/expenses/{id}", accountingHandler.UpdateExpense)
		r.Delete("/expenses/{id}", accountingHandler.DeleteExpense)

		r.Get("/incomes", accountingHandler.ListIncomes)
		r.Post("/incomes", accountingHandler.CreateIncome)
		r.Put("/incomes/{id}", accountingHandler.UpdateIncome)
		r.Delete("/incomes/{id}", accountingHandler.DeleteIncome)
	})

	log.Println("servidor corriendo en :8080")
	http.ListenAndServe(":8080", r)
}
