package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type ipRateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	limit    int
	window   time.Duration
}

func newIPRateLimiter(limit int, window time.Duration) *ipRateLimiter {
	limiter := &ipRateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}

	// Limpieza periódica de IPs inactivas para evitar fuga de memoria
	go func() {
		ticker := time.NewTicker(2 * window)
		defer ticker.Stop()
		for range ticker.C {
			limiter.mu.Lock()
			now := time.Now()
			for ip, times := range limiter.requests {
				var validTimes []time.Time
				for _, t := range times {
					if now.Sub(t) <= limiter.window {
						validTimes = append(validTimes, t)
					}
				}
				if len(validTimes) == 0 {
					delete(limiter.requests, ip)
				} else {
					limiter.requests[ip] = validTimes
				}
			}
			limiter.mu.Unlock()
		}
	}()

	return limiter
}

func getClientIP(r *http.Request) string {
	xfwd := r.Header.Get("X-Forwarded-For")
	if xfwd != "" {
		parts := strings.Split(xfwd, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}
	xreal := r.Header.Get("X-Real-IP")
	if xreal != "" {
		return strings.TrimSpace(xreal)
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// RateLimit crea un middleware que limita a maxRequests por ventana de tiempo por IP
func RateLimit(maxRequests int, window time.Duration) func(http.Handler) http.Handler {
	limiter := newIPRateLimiter(maxRequests, window)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)

			limiter.mu.Lock()
			now := time.Now()
			times := limiter.requests[ip]

			var validTimes []time.Time
			for _, t := range times {
				if now.Sub(t) <= limiter.window {
					validTimes = append(validTimes, t)
				}
			}

			if len(validTimes) >= limiter.limit {
				limiter.requests[ip] = validTimes
				limiter.mu.Unlock()
				w.Header().Set("Retry-After", "60")
				http.Error(w, "Demasiados intentos. Por favor intenta de nuevo en un minuto.", http.StatusTooManyRequests)
				return
			}

			validTimes = append(validTimes, now)
			limiter.requests[ip] = validTimes
			limiter.mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}
