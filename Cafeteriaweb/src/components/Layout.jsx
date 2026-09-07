import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { processImageUrl } from '../utils/imageUtils'
import {
  ShoppingBag,
  FileText,
  UtensilsCrossed,
  Package,
  Coffee,
  DollarSign,
  BarChart3,
  CheckSquare,
  Users,
  UserCheck,
  User as UserIcon,
  ChevronLeft,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  QrCode
} from 'lucide-react'
import { ToffeeMarblePattern } from './ToffeeMarblePattern'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('toffe_dark_mode')
    if (saved !== null) return saved === 'true'
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const [userAvatars, setUserAvatars] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('toffe_user_avatars') || '{}')
    } catch (e) {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem('toffe_dark_mode', String(isDarkMode))
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev)

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const roleLabels = {
    owner: 'DUEÑO',
    admin: 'ADMINISTRADOR',
    employee: 'EMPLEADO',
    empleado: 'EMPLEADO'
  }

  const currentRole = (user?.role || '').toLowerCase()
  const isOwner = currentRole === 'owner' || currentRole === 'dueño'
  const isAdmin = isOwner || currentRole === 'admin' || currentRole === 'administrador'

  const rawAvatarUrl = user?.avatar_url || (user && user.id && userAvatars[user.id]) || ''
  const userAvatarUrl = processImageUrl(rawAvatarUrl)

  const navSections = [
    {
      title: 'OPERACIÓN & VENTAS',
      items: [
        { to: '/', label: 'Ventas', icon: ShoppingBag, end: true, show: true },
        { to: '/sales/history', label: 'Historial Ventas', icon: FileText, show: true },
        { to: '/comandas', label: 'Comandas', icon: UtensilsCrossed, show: true },
        { to: '/customers', label: 'Clientes', icon: Users, show: true },
        { to: '/qrs', label: 'Códigos QR', icon: QrCode, show: true }
      ]
    },
    {
      title: 'CATÁLOGO & INVENTARIO',
      items: [
        { to: '/inventory', label: 'Inventario', icon: Package, show: true },
        { to: '/products', label: 'Productos', icon: Coffee, show: true }
      ]
    },
    {
      title: 'FINANZAS & CONTROL',
      items: [
        { to: '/accounting', label: 'Contabilidad', icon: DollarSign, show: isOwner },
        { to: '/stats', label: 'Estadísticas', icon: BarChart3, show: isOwner },
        { to: '/tasks', label: 'Tareas', icon: CheckSquare, show: true }
      ]
    },
    {
      title: 'SISTEMA & CUENTA',
      items: [
        { to: '/users', label: 'Personal & Roles', icon: UserCheck, show: isOwner },
        { to: '/profile', label: 'Mi Perfil', icon: UserIcon, show: true }
      ]
    }
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FEE4D7]/40 dark:bg-[#150904] text-[#432414] dark:text-[#FEE4D7] transition-colors duration-200">
      {/* Mobile Top Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-[#201009] border-b border-[#D4B28E]/60 dark:border-[#9F6839]/40 px-4 flex items-center justify-between z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-xl text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7] dark:hover:bg-[#2A150C]"
            aria-label="Abrir menú"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src="/icon-192.png"
              alt="Toffee Logo"
              className="w-8 h-8 rounded-xl object-cover border border-[#9F6839]"
            />
            <div>
              <span className="font-extrabold text-sm text-[#432414] dark:text-[#FEE4D7] block leading-tight">
                Toffee
              </span>
              <span className="text-[9px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">
                "HECHO POR Y PARA ESTUDIANTES"
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] dark:hover:bg-[#2A150C]"
        >
          {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-45"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 flex flex-col justify-between h-full bg-white dark:bg-[#201009] border-r border-[#D4B28E]/60 dark:border-[#9F6839]/40 shadow-sm transition-all duration-300 z-50 select-none ${
          mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64 lg:min-w-[16rem]'}`}
      >
        <div className="flex-1 overflow-y-auto">
          {/* Header & Logo */}
          <div className="relative overflow-hidden p-4 border-b border-[#D4B28E]/50 dark:border-[#9F6839]/30 bg-[#FEE4D7]/40 dark:bg-[#2A150C]">
            <div
              className="absolute inset-0 opacity-25 dark:opacity-20 pointer-events-none bg-cover bg-center"
              style={{ backgroundImage: "url('/toffe-pattern-light.png')" }}
            />
            <div
              className="absolute inset-0 opacity-20 pointer-events-none bg-cover bg-center hidden dark:block"
              style={{ backgroundImage: "url('/toffe-pattern-dark.png')" }}
            />

            <div className={`relative flex items-center ${isCollapsed ? 'justify-center w-full' : 'justify-between'} z-10`}>
              <button
                type="button"
                onClick={toggleCollapse}
                className="flex items-center gap-3 cursor-pointer group focus:outline-none"
                title={isCollapsed ? 'Desplegar menú' : 'Contraer menú'}
              >
                <img
                  src="/icon-192.png"
                  alt="Toffee Logo"
                  className="w-10 h-10 rounded-2xl object-cover border border-[#9F6839] shadow-xs group-hover:scale-105 transition-transform shrink-0"
                />
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="font-bold text-lg text-[#432414] dark:text-[#FEE4D7] tracking-tight leading-tight">
                      Toffee
                    </span>
                    <span className="text-[9px] font-bold tracking-wider text-[#9F6839] dark:text-[#DABA8C] uppercase leading-tight">
                      "HECHO POR Y PARA ESTUDIANTES"
                    </span>
                  </div>
                )}
              </button>

              {/* Toggle Arrow Button in desktop */}
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="hidden lg:flex p-1.5 rounded-xl text-[#432414]/70 dark:text-[#DABA8C]/80 hover:text-[#432414] dark:hover:text-[#FEE4D7] hover:bg-[#FEE4D7] dark:hover:bg-[#3E2114] transition-colors cursor-pointer"
                  title="Contraer menú"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              {/* Close in mobile */}
              <button
                onClick={() => setMobileOpen(false)}
                className="lg:hidden p-1.5 rounded-xl text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7] dark:hover:bg-[#3E2114]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Items (Categorizadas por Área) */}
          <nav className="p-3 space-y-4">
            {navSections.map((section, sIdx) => {
              const visibleItems = section.items.filter((it) => it.show)
              if (visibleItems.length === 0) return null

              return (
                <div key={section.title} className="space-y-1">
                  {!isCollapsed ? (
                    <span className="text-[10px] font-extrabold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider px-3 pb-1 block">
                      {section.title}
                    </span>
                  ) : (
                    sIdx > 0 && <div className="my-2 border-t border-[#D4B28E]/40 dark:border-[#9F6839]/30" />
                  )}

                  {visibleItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 group relative ${
                            isActive
                              ? 'bg-[#9F6839] text-white shadow-xs'
                              : 'text-[#432414]/80 dark:text-[#FEE4D7]/80 hover:text-[#432414] dark:hover:text-[#FEE4D7] hover:bg-[#FEE4D7]/70 dark:hover:bg-[#2E180E]'
                          } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`
                        }
                        title={isCollapsed ? item.label : undefined}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                                isActive ? 'text-[#FEE4D7]' : 'text-[#9F6839] dark:text-[#DABA8C]'
                              }`}
                            />
                            {!isCollapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                          </>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              )
            })}
          </nav>
        </div>

        {/* Dark Mode Switcher Section */}
        <div className="px-3 py-2 border-t border-[#D4B28E]/40 dark:border-[#9F6839]/30 bg-[#FEE4D7]/20 dark:bg-[#1B0C06]">
          {!isCollapsed ? (
            <div className="flex items-center justify-between p-2 rounded-2xl bg-white dark:bg-[#2B160C] border border-[#D4B28E]/70 dark:border-[#9F6839]/50 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-1.5 rounded-xl transition-colors ${
                    isDarkMode ? 'bg-[#432414] text-[#DABA8C]' : 'bg-[#FEE4D7] text-[#9F6839]'
                  }`}
                >
                  {isDarkMode ? <Moon className="w-3.5 h-3.5 text-[#DABA8C]" /> : <Sun className="w-3.5 h-3.5 text-[#9F6839]" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-[#432414] dark:text-[#FEE4D7] leading-none">
                    {isDarkMode ? 'Modo Oscuro' : 'Modo Claro'}
                  </span>
                  <span className="text-[9px] font-semibold text-[#9F6839] dark:text-[#DABA8C] mt-0.5 leading-none">
                    Paleta Tostada
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  isDarkMode ? 'bg-[#9F6839]' : 'bg-[#D4B28E]'
                }`}
                title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              >
                <span
                  className={`pointer-events-none inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white dark:bg-[#FEE4D7] shadow-lg transition duration-200 ${
                    isDarkMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  {isDarkMode ? <Moon className="w-2.5 h-2.5 text-[#432414]" /> : <Sun className="w-2.5 h-2.5 text-[#9F6839]" />}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={toggleDarkMode}
                className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                  isDarkMode
                    ? 'bg-[#2B160C] border-[#9F6839] text-[#DABA8C] hover:bg-[#3B1F11]'
                    : 'bg-white border-[#D4B28E] text-[#9F6839] hover:bg-[#FEE4D7]'
                }`}
                title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              >
                {isDarkMode ? <Moon className="w-4 h-4 text-[#DABA8C]" /> : <Sun className="w-4 h-4 text-[#9F6839]" />}
              </button>
            </div>
          )}
        </div>

        {/* Active User Footer */}
        <div className="p-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/40 bg-[#FEE4D7]/50 dark:bg-[#241209]">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
            <div
              onClick={() => navigate('/profile')}
              className={`flex items-center gap-2.5 cursor-pointer group ${isCollapsed ? 'justify-center' : 'overflow-hidden text-left flex-1 min-w-0'}`}
              title="Ver mi perfil"
            >
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt={user?.username}
                  className="w-9 h-9 rounded-full object-cover border border-[#9F6839] shrink-0 shadow-xs group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#9F6839] text-[#FEE4D7] font-bold flex items-center justify-center text-sm shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[#432414] dark:text-[#FEE4D7] truncate group-hover:text-[#9F6839] transition-colors">
                    {user?.username}
                  </span>
                  <span className="inline-block mt-0.5">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-[#1C0D07] text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E] dark:border-[#9F6839] uppercase tracking-wider">
                      {roleLabels[user?.role] || user?.role}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-[#9F6839] dark:text-[#DABA8C] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0 cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Screen Content */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pt-14 lg:pt-0 bg-[#FEE4D7]/30 dark:bg-[#150904]">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}