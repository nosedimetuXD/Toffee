import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Users from './pages/Users'
import Products from './pages/Products'
import Inventory from './pages/Inventory'
import Sales from './pages/Sales'
import SalesHistory from './pages/SalesHistory'
import Comandas from './pages/Comandas'
import Accounting from './pages/Accounting'
import Stats from './pages/Stats'
import Tasks from './pages/Tasks'
import Recipe from './pages/Recipe'
import Profile from './pages/Profile'
import Customers from './pages/Customers'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (roles && Array.isArray(roles)) {
    const userRole = (user.role || '').toLowerCase()
    const isAllowed = roles.some((r) => {
      const targetRole = r.toLowerCase()
      if (targetRole === 'owner' || targetRole === 'dueño') return userRole === 'owner' || userRole === 'dueño'
      if (targetRole === 'admin' || targetRole === 'administrador') return userRole === 'admin' || userRole === 'administrador' || userRole === 'owner' || userRole === 'dueño'
      return userRole === targetRole
    })
    if (!isAllowed) return <Navigate to="/" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Punto de Venta es la página principal */}
        <Route index element={<Sales />} />
        <Route path="sales/history" element={<SalesHistory />} />
        <Route path="comandas" element={<Comandas />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="products" element={<Products />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="customers" element={<Customers />} />
        <Route path="profile" element={<Profile />} />

        <Route
          path="accounting"
          element={
            <ProtectedRoute roles={['owner']}>
              <Accounting />
            </ProtectedRoute>
          }
        />

        <Route
          path="stats"
          element={
            <ProtectedRoute roles={['owner']}>
              <Stats />
            </ProtectedRoute>
          }
        />

        <Route
          path="users"
          element={
            <ProtectedRoute roles={['owner']}>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="products/:id/recipe"
          element={
            <ProtectedRoute>
              <Recipe />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Pagina 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}