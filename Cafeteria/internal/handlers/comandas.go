package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
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

type ComandaHandler struct {
	DB  *pgxpool.Pool
	Hub *events.Hub
}

func NewComandaHandler(db *pgxpool.Pool, hub *events.Hub) *ComandaHandler {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = db.Exec(ctx, `ALTER TABLE comandas ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE`)
	_, _ = db.Exec(ctx, `ALTER TABLE comandas ADD COLUMN IF NOT EXISTS prepared_by UUID REFERENCES users(id)`)
	_, _ = db.Exec(ctx, `ALTER TABLE comandas ADD COLUMN IF NOT EXISTS prepared_by_username VARCHAR(100)`)
	_, _ = db.Exec(ctx, `
		UPDATE comandas c
		SET prepared_by = COALESCE(c.prepared_by, s.sold_by),
		    prepared_by_username = COALESCE(NULLIF(c.prepared_by_username, ''), NULLIF(c.prepared_by_username, 'Por asignar'), NULLIF(s.sold_by_name, ''), u.username, 'Personal')
		FROM sales s
		LEFT JOIN users u ON s.sold_by = u.id
		WHERE c.sale_id = s.id AND (c.prepared_by_username IS NULL OR c.prepared_by_username = '' OR c.prepared_by_username = 'Por asignar')
	`)
	_, _ = db.Exec(ctx, `
		DO $$
		DECLARE
			seq_name text;
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM comandas) THEN
				seq_name := pg_get_serial_sequence('comandas', 'order_number');
				IF seq_name IS NOT NULL AND seq_name != '' THEN
					EXECUTE 'SELECT setval(' || quote_literal(seq_name) || ', 1, false)';
				ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'comandas_order_number_seq') THEN
					PERFORM setval('comandas_order_number_seq', 1, false);
				END IF;
			END IF;
		END $$;
	`)
	return &ComandaHandler{DB: db, Hub: hub}
}

// GET /comandas
func (h *ComandaHandler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(),
		`SELECT c.id, c.order_number, COALESCE(c.sale_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(c.customer_name, ''), c.status, COALESCE(c.notes, ''), c.created_at, c.updated_at, c.ready_at, c.prepared_by, 
		        COALESCE(
		          NULLIF(NULLIF(c.prepared_by_username, ''), 'Por asignar'), 
		          u.username, 
		          NULLIF(s.sold_by_name, ''), 
		          su.username, 
		          CASE WHEN c.status != 'pendiente' THEN 'Personal' ELSE 'Por asignar' END
		        ) AS prepared_by_username
		 FROM comandas c
		 LEFT JOIN users u ON c.prepared_by = u.id
		 LEFT JOIN sales s ON c.sale_id = s.id
		 LEFT JOIN users su ON s.sold_by = su.id
		 WHERE c.created_at >= (now() - INTERVAL '12 hours') OR c.status IN ('pendiente', 'en_preparacion', 'listo')
		 ORDER BY CASE c.status 
		    WHEN 'pendiente' THEN 1 
		    WHEN 'en_preparacion' THEN 2 
		    WHEN 'listo' THEN 3 
		    WHEN 'entregado' THEN 4 
		    WHEN 'cancelado' THEN 5 
		    ELSE 6 END, c.created_at DESC`)
	if err != nil {
		log.Printf("error consultando comandas: %v", err)
		http.Error(w, "error consultando comandas", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var comandas []models.Comanda
	for rows.Next() {
		var c models.Comanda
		if err := rows.Scan(&c.ID, &c.OrderNumber, &c.SaleID, &c.CustomerName, &c.Status, &c.Notes, &c.CreatedAt, &c.UpdatedAt, &c.ReadyAt, &c.PreparedBy, &c.PreparedByUsername); err != nil {
			log.Printf("error leyendo comanda: %v", err)
			http.Error(w, "error leyendo comanda", http.StatusInternalServerError)
			return
		}
		comandas = append(comandas, c)
	}

	// Cargar los items de cada comanda
	for i := range comandas {
		itemRows, err := h.DB.Query(r.Context(),
			`SELECT product_id, product_name, quantity, COALESCE(notes, '') 
			 FROM comanda_items 
			 WHERE comanda_id = $1`, comandas[i].ID)
		if err != nil {
			log.Printf("error cargando items de comanda %s: %v", comandas[i].ID, err)
			continue
		}

		for itemRows.Next() {
			var ci models.ComandaItem
			if err := itemRows.Scan(&ci.ProductID, &ci.ProductName, &ci.Quantity, &ci.Notes); err == nil {
				comandas[i].Items = append(comandas[i].Items, ci)
			}
		}
		itemRows.Close()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comandas)
}

// PATCH /comandas/{id}/status
type updateComandaStatusRequest struct {
	Status             string `json:"status"`
	PreparedByUsername string `json:"prepared_by_username"`
}

func (h *ComandaHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var req updateComandaStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "cuerpo inválido", http.StatusBadRequest)
		return
	}

	statusStr := strings.ToLower(strings.TrimSpace(req.Status))
	validStatuses := map[string]bool{
		"pendiente":      true,
		"en_preparacion": true,
		"listo":          true,
		"entregado":      true,
		"cancelado":      true,
	}

	if !validStatuses[statusStr] {
		http.Error(w, "estado de comanda inválido", http.StatusBadRequest)
		return
	}

	var currentStatus string
	_ = h.DB.QueryRow(r.Context(), "SELECT status FROM comandas WHERE id = $1", id).Scan(&currentStatus)

	// Si se está cancelando una comanda que no estaba cancelada previa a este request, devolver los insumos al inventario
	if statusStr == "cancelado" && currentStatus != "cancelado" {
		itemRows, errItem := h.DB.Query(r.Context(),
			`SELECT product_id, quantity FROM comanda_items WHERE comanda_id = $1`, id)
		if errItem == nil {
			type itemToReturn struct {
				ProductID uuid.UUID
				Quantity  int
			}
			var items []itemToReturn
			for itemRows.Next() {
				var it itemToReturn
				if errScan := itemRows.Scan(&it.ProductID, &it.Quantity); errScan == nil {
					items = append(items, it)
				}
			}
			itemRows.Close()

			for _, it := range items {
				ingRows, errIng := h.DB.Query(r.Context(),
					`SELECT ingredient_id, quantity_used FROM product_ingredients WHERE product_id = $1`, it.ProductID)
				if errIng == nil {
					for ingRows.Next() {
						var ingID uuid.UUID
						var qtyUsed float64
						if errScan := ingRows.Scan(&ingID, &qtyUsed); errScan == nil {
							restorationQty := qtyUsed * float64(it.Quantity)
							_, _ = h.DB.Exec(r.Context(),
								`UPDATE ingredients SET quantity = quantity + $1, updated_at = now() WHERE id = $2`,
								restorationQty, ingID)
						}
					}
					ingRows.Close()
				}
			}
			h.Hub.Publish("inventory_updated", map[string]interface{}{"action": "comanda_cancellation_restore"})
		}
	}

	userIDVal := r.Context().Value(custommw.ContextUserID)

	var userID *uuid.UUID
	if idVal, ok := userIDVal.(uuid.UUID); ok {
		userID = &idVal
	} else if idStr, ok := userIDVal.(string); ok {
		if parsed, pErr := uuid.Parse(idStr); pErr == nil {
			userID = &parsed
		}
	}

	var preparedBy *uuid.UUID
	var preparedByName string

	if strings.TrimSpace(req.PreparedByUsername) != "" && strings.TrimSpace(req.PreparedByUsername) != "Por asignar" {
		preparedByName = strings.TrimSpace(req.PreparedByUsername)
	}

	if userID != nil {
		var validID uuid.UUID
		var dbUsername string
		errU := h.DB.QueryRow(r.Context(), "SELECT id, username FROM users WHERE id = $1", *userID).Scan(&validID, &dbUsername)
		if errU == nil {
			preparedBy = &validID
			if preparedByName == "" || preparedByName == "Por asignar" {
				preparedByName = dbUsername
			}
		}
	}

	if (preparedByName == "" || preparedByName == "Por asignar") && statusStr != "pendiente" {
		var saleSeller string
		_ = h.DB.QueryRow(r.Context(),
			`SELECT COALESCE(NULLIF(s.sold_by_name, ''), u.username, '') 
			 FROM comandas c 
			 JOIN sales s ON c.sale_id = s.id 
			 LEFT JOIN users u ON s.sold_by = u.id 
			 WHERE c.id = $1`, id).Scan(&saleSeller)
		if saleSeller != "" {
			preparedByName = saleSeller
		} else {
			preparedByName = "Personal"
		}
	}

	var c models.Comanda
	var updateErr error

	updateErr = h.DB.QueryRow(r.Context(),
		`UPDATE comandas 
		 SET status = $1, 
		     updated_at = now(), 
		     ready_at = COALESCE(ready_at, CASE WHEN $1 IN ('listo', 'entregado') THEN now() ELSE NULL END),
		     prepared_by = COALESCE($3, prepared_by),
		     prepared_by_username = CASE 
		       WHEN $4 <> '' AND $4 <> 'Por asignar' THEN $4 
		       WHEN COALESCE(NULLIF(prepared_by_username, ''), 'Por asignar') <> 'Por asignar' THEN prepared_by_username
		       ELSE $4
		     END
		 WHERE id = $2 
		 RETURNING id, order_number, COALESCE(sale_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(customer_name, ''), status, COALESCE(notes, ''), created_at, updated_at, ready_at, prepared_by, COALESCE(prepared_by_username, '')`,
		statusStr, id, preparedBy, preparedByName,
	).Scan(&c.ID, &c.OrderNumber, &c.SaleID, &c.CustomerName, &c.Status, &c.Notes, &c.CreatedAt, &c.UpdatedAt, &c.ReadyAt, &c.PreparedBy, &c.PreparedByUsername)

	// Ultimate fallback si falla cualquier cosa
	if updateErr != nil {
		if errors.Is(updateErr, pgx.ErrNoRows) {
			http.Error(w, "comanda no encontrada", http.StatusNotFound)
			return
		}
		log.Printf("ejecutando fallback minimo para comanda %s por error: %v", id, updateErr)
		updateErr = h.DB.QueryRow(r.Context(),
			`UPDATE comandas SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, order_number, COALESCE(sale_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(customer_name, ''), status, COALESCE(notes, ''), created_at, updated_at, ready_at, prepared_by, COALESCE(prepared_by_username, '')`,
			statusStr, id,
		).Scan(&c.ID, &c.OrderNumber, &c.SaleID, &c.CustomerName, &c.Status, &c.Notes, &c.CreatedAt, &c.UpdatedAt, &c.ReadyAt, &c.PreparedBy, &c.PreparedByUsername)

		if updateErr != nil {
			log.Printf("error crítico actualizando comanda %s: %v", id, updateErr)
			http.Error(w, "error actualizando comanda", http.StatusInternalServerError)
			return
		}
	}

	h.Hub.Publish("comanda_updated", map[string]interface{}{
		"id":           c.ID,
		"order_number": c.OrderNumber,
		"status":       c.Status,
		"updated_at":   c.UpdatedAt,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

// Handler genérico de cancelación para capturar cualquier ruta alternativa (/comandas/{id}/cancel, /sales/{id}/cancel, etc.)
func (h *ComandaHandler) CancelComanda(w http.ResponseWriter, r *http.Request) {
	// Verificar que el usuario solicitante tenga rol dueño
	roleVal, _ := r.Context().Value(custommw.ContextRole).(models.UserRole)
	roleStr := strings.ToLower(string(roleVal))
	if roleStr != "owner" && roleStr != "dueño" {
		http.Error(w, "Acceso denegado: solo usuarios con rol Dueño pueden cancelar ventas", http.StatusForbidden)
		return
	}

	idParam := chi.URLParam(r, "id")
	if idParam == "" {
		idParam = chi.URLParam(r, "sale_id")
	}

	var comandaID uuid.UUID

	if idParam != "" {
		parsed, pErr := uuid.Parse(idParam)
		if pErr == nil {
			// Probar si el ID es de comanda o sale_id
			var foundID uuid.UUID
			errSearch := h.DB.QueryRow(r.Context(), "SELECT id FROM comandas WHERE id = $1 OR sale_id = $1 LIMIT 1", parsed).Scan(&foundID)
			if errSearch == nil {
				comandaID = foundID
			}
		}
	}

	if comandaID == uuid.Nil {
		// Leer del cuerpo si viene en JSON
		var body struct {
			ID        string `json:"id"`
			ComandaID string `json:"comanda_id"`
			SaleID    string `json:"sale_id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		targetStr := body.ID
		if targetStr == "" {
			targetStr = body.ComandaID
		}
		if targetStr == "" {
			targetStr = body.SaleID
		}
		if targetStr != "" {
			if parsed, pErr := uuid.Parse(targetStr); pErr == nil {
				_ = h.DB.QueryRow(r.Context(), "SELECT id FROM comandas WHERE id = $1 OR sale_id = $1 LIMIT 1", parsed).Scan(&comandaID)
			}
		}
	}

	if comandaID == uuid.Nil {
		http.Error(w, "Comanda no encontrada para cancelar", http.StatusNotFound)
		return
	}

	// Ejecutar la cancelación del estado
	r.URL.RawQuery = ""
	rctx := chi.RouteContext(r.Context())
	if rctx != nil {
		rctx.URLParams.Add("id", comandaID.String())
	}

	// Crear request sintético para UpdateStatus
	reqBody, _ := json.Marshal(updateComandaStatusRequest{Status: "cancelado"})
	r.Body = io.NopCloser(bytes.NewReader(reqBody))

	h.UpdateStatus(w, r)
}

