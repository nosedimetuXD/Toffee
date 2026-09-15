package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/NosedimetuXD/cafeteria/internal/models"
)

type Claims struct {
	UserID uuid.UUID       `json:"user_id"`
	Role   models.UserRole `json:"role"`
	jwt.RegisteredClaims
}

var (
	jwtSecretOnce sync.Once
	cachedSecret  []byte
)

func getJWTSecret() []byte {
	jwtSecretOnce.Do(func() {
		secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
		if secret != "" {
			cachedSecret = []byte(secret)
			return
		}
		log.Println("ADVERTENCIA DE SEGURIDAD: JWT_SECRET no está configurado. Se generó una clave criptográfica aleatoria para esta instancia.")
		randomBytes := make([]byte, 32)
		if _, err := rand.Read(randomBytes); err != nil {
			log.Fatalf("error generando clave JWT aleatoria: %v", err)
		}
		cachedSecret = []byte(hex.EncodeToString(randomBytes))
	})
	return cachedSecret
}

func GenerateToken(userID uuid.UUID, role models.UserRole) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(12 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getJWTSecret())
}

func ParseToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de firma no válido: %v", t.Header["alg"])
		}
		return getJWTSecret(), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("token inválido o expirado")
	}
	return claims, nil
}

