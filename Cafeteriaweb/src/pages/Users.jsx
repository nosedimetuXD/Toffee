import { useEffect, useState, useMemo } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { processImageUrl, compressAndReadFile } from '../utils/imageUtils'
import { Users as UsersIcon, Shield, Key, Plus, Edit2, Lock, Camera, Upload, Trash2, BarChart3, TrendingUp, DollarSign, ShoppingBag, CheckSquare, ShieldAlert, AlertCircle, Award, FileText, Clock } from 'lucide-react'

function UserStatsProfileModal({ selectedUser, sales, comandas, onClose, loading }) {
  const targetUsername = String(selectedUser?.username || '').toLowerCase()
  const targetId = selectedUser?.id

  const userSales = useMemo(() => {
    const safeSales = Array.isArray(sales) ? sales : []
    return safeSales.filter(
      (s) => s.status !== 'cancelado' && (
        (targetId && s.sold_by === targetId) ||
        (s.sold_by_username && String(s.sold_by_username).toLowerCase() === targetUsername) ||
        (s.sold_by_name && String(s.sold_by_name).toLowerCase() === targetUsername)
      )
    )
  }, [sales, targetId, targetUsername])

  const userComandas = useMemo(() => {
    const safeComandas = Array.isArray(comandas) ? comandas : []
    return safeComandas.filter(
      (c) => (targetId && c.prepared_by === targetId) ||
             (c.prepared_by_username && String(c.prepared_by_username).toLowerCase() === targetUsername)
    )
  }, [comandas, targetId, targetUsername])

  const stats = useMemo(() => {
    const totalCount = userSales.length
    const totalRevenue = userSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
    const avgSale = totalCount > 0 ? totalRevenue / totalCount : 0

    const productCounts = {}
    userSales.forEach((s) => {
      let items = s.items
      if (typeof items === 'string') {
        try { items = JSON.parse(items) } catch (e) { items = [] }
      }
      (items || []).forEach((it) => {
        const name = it.product_name || it.ProductName || it.name || 'Producto'
        const q = Number(it.quantity || it.Quantity || 1)
        productCounts[name] = (productCounts[name] || 0) + q
      })
    })

    let topProduct = 'Ninguno aún'
    let maxQty = 0
    Object.entries(productCounts).forEach(([name, qty]) => {
      if (qty > maxQty) {
        maxQty = qty
        topProduct = name
      }
    })

    let totalPrepMin = 0
    let prepCount = 0
    userComandas.forEach((c) => {
      if ((c.status === 'listo' || c.status === 'entregado') && c.created_at) {
        const end = new Date(c.ready_at || c.updated_at || c.created_at)
        const start = new Date(c.created_at)
        const min = (end - start) / (1000 * 60)
        if (min >= 0 && min < 1440) {
          totalPrepMin += min
          prepCount += 1
        }
      }
    })
    const avgPrepTimeMin = prepCount > 0 ? Math.round(totalPrepMin / prepCount) : 0

    return {
      totalCount,
      totalRevenue,
      avgSale,
      topProduct,
      maxQty,
      avgPrepTimeMin
    }
  }, [userSales, userComandas])

  const rawAvatar = selectedUser?.avatar_url || ''
  const avatarUrl = processImageUrl(rawAvatar)
  const roleLabel = selectedUser?.role === 'owner' || selectedUser?.role === 'dueño' ? 'DUEÑO' : selectedUser?.role === 'admin' || selectedUser?.role === 'administrador' ? 'ADMINISTRADOR' : 'EMPLEADO'

  return (
    <Modal
      isOpen={Boolean(selectedUser)}
      onClose={onClose}
      title={`Perfil & Estadísticas: ${selectedUser?.username || 'Usuario'}`}
      maxWidth="max-w-xl"
    >
      {loading ? (
        <div className="py-12 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#9F6839] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-[#9F6839]">Cargando métricas del usuario...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Tarjeta Perfil de Usuario */}
          <div className="flex items-center gap-4 p-4 rounded-3xl bg-[#FEE4D7]/40 dark:bg-[#2A150C] border border-[#D4B28E] dark:border-[#9F6839]/40">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={selectedUser?.username}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#9F6839] shadow-sm"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#9F6839] text-[#FEE4D7] font-black text-2xl flex items-center justify-center border-2 border-[#D4B28E]">
                {selectedUser?.username ? selectedUser.username.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div>
              <h3 className="text-lg font-extrabold text-[#432414] dark:text-[#FEE4D7]">
                {selectedUser?.username}
              </h3>
              <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-[#9F6839] text-white text-[10px] font-black uppercase tracking-wider">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Grid de 4 Estadísticas exactas a Mi Perfil */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/40 space-y-1">
              <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider">Ventas Realizadas</span>
              <p className="text-2xl font-extrabold text-[#432414] dark:text-[#FEE4D7]">{stats.totalCount}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/40 space-y-1">
              <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider">Ingresos Generados</span>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">${stats.totalRevenue.toLocaleString()}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/40 space-y-1">
              <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider">Promedio Ticket</span>
              <p className="text-2xl font-extrabold text-[#432414] dark:text-[#FEE4D7]">${Math.round(stats.avgSale).toLocaleString()}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/40 space-y-1">
              <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-[#9F6839]" /> Más Vendido
              </span>
              <p className="text-sm font-extrabold text-[#432414] dark:text-[#FEE4D7] truncate">{stats.topProduct}</p>
              {stats.maxQty > 0 && (
                <span className="text-[10px] font-bold text-[#9F6839]">{stats.maxQty} unidades</span>
              )}
            </div>
          </div>

          {/* Demora Comandas */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/40 space-y-1">
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#9F6839]" /> Demora Promedio Preparación
            </span>
            <p className="text-xl font-extrabold text-[#432414] dark:text-[#FEE4D7]">
              {stats.avgPrepTimeMin > 0 ? `${stats.avgPrepTimeMin} min` : '—'}
            </p>
          </div>

          {/* Últimas Ventas Registradas */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#9F6839]" /> Últimas Ventas Registradas
              </span>
              <span className="text-[10px] font-bold text-[#9F6839]">{userSales.length} ventas totales</span>
            </div>

            {userSales.length === 0 ? (
              <p className="text-xs text-[#9F6839] italic py-2">Este usuario no tiene ventas registradas.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {userSales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#FEE4D7]/20 dark:bg-[#201009] border border-[#D4B28E]/30 text-xs">
                    <div>
                      <span className="font-bold text-[#432414] dark:text-[#FEE4D7] block">{sale.customer_name || 'Cliente'}</span>
                      <span className="text-[10px] text-[#9F6839]">{new Date(sale.created_at).toLocaleString()}</span>
                    </div>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">${Number(sale.total).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-[#9F6839] hover:bg-[#835229] text-white font-extrabold text-xs cursor-pointer shadow-md"
            >
              Cerrar Rendimiento
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Users() {
  const { user: currentUser, updateUser } = useAuth()
  const [users, setUsers] = useState([])
  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [tasks, setTasks] = useState([])
  const [wasteReports, setWasteReports] = useState([])
  const [comandas, setComandas] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Modal Crear / Editar Usuario
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('employee')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Modal Stats Personales de Usuario
  const [selectedUserForStats, setSelectedUserForStats] = useState(null)

  async function loadData() {
    try {
      const [uData, sData, eData, tData, wData, cData] = await Promise.all([
        api.get('/users').catch(() => []),
        api.get('/sales?period=all').catch(() => []),
        api.get('/expenses?period=all').catch(() => []),
        api.get('/tasks').catch(() => []),
        api.get('/waste').catch(() => []),
        api.get('/comandas').catch(() => [])
      ])
      setUsers(uData || [])
      setSales(sData || [])
      setExpenses(eData || [])
      setTasks(tData || [])
      setWasteReports(wData || [])
      setComandas(cData || [])
    } catch (err) {
      setPageError('No se pudieron cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openCreateModal() {
    setEditingUser(null)
    setUsername('')
    setPassword('')
    setRole('employee')
    setAvatarUrl('')
    setFormError('')
    setIsModalOpen(true)
  }

  function openEditModal(userItem) {
    setEditingUser(userItem)
    setUsername(userItem.username)
    setPassword('')
    setRole(userItem.role)
    setAvatarUrl(userItem.avatar_url || '')
    setFormError('')
    setIsModalOpen(true)
  }

  const [statsLoading, setStatsLoading] = useState(false)

  async function openStatsModal(userItem) {
    setSelectedUserForStats(userItem)
    setStatsLoading(true)
    try {
      const [sData, eData, tData, wData, cData] = await Promise.all([
        api.get('/sales?period=all').catch(() => []),
        api.get('/expenses?period=all').catch(() => []),
        api.get('/tasks').catch(() => []),
        api.get('/waste').catch(() => []),
        api.get('/comandas').catch(() => [])
      ])
      setSales(sData || [])
      setExpenses(eData || [])
      setTasks(tData || [])
      setWasteReports(wData || [])
      setComandas(cData || [])
    } catch (err) {
      console.error('Error cargando estadísticas:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    compressAndReadFile(file, (compressedDataUrl) => {
      setAvatarUrl(compressedDataUrl)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')

    try {
      const finalAvatar = avatarUrl.trim()

      if (editingUser) {
        const updated = await api.put(`/users/${editingUser.id}`, {
          username,
          password: password ? password : undefined,
          role,
          avatar_url: finalAvatar
        })

        if (currentUser && currentUser.id === editingUser.id) {
          updateUser({ username: updated.username, role: updated.role, avatar_url: finalAvatar })
        }
      } else {
        await api.post('/users', { username, password, role, avatar_url: finalAvatar })
      }

      setIsModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(
        err.message.includes('ya')
          ? 'Ese nombre de usuario ya está registrado'
          : err.message || 'No se pudo guardar el usuario'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteUser(userItem) {
    if (userItem.is_primary || userItem.username.trim().toLowerCase() === 'camilo osorio') {
      alert('El dueño principal está protegido permanentemente y no se puede eliminar.')
      return
    }
    if (currentUser && currentUser.id === userItem.id) {
      alert('No puedes eliminar tu propia cuenta activa.')
      return
    }

    if (!window.confirm(`¿Estás seguro de eliminar permanentemente al usuario "${userItem.username}"?`)) {
      return
    }

    try {
      setUsers((prev) => prev.filter((u) => u.id !== userItem.id))
      await api.delete(`/users/${userItem.id}`)
      await loadData()
    } catch (err) {
      alert(err.message || 'No se pudo eliminar el usuario')
      await loadData()
    }
  }

  const userStatsCalculated = useMemo(() => {
    if (!selectedUserForStats || !selectedUserForStats.username) return null

    const targetUsername = String(selectedUserForStats.username).toLowerCase()
    const targetId = selectedUserForStats.id

    const safeSales = Array.isArray(sales) ? sales : []
    const safeExpenses = Array.isArray(expenses) ? expenses : []
    const safeTasks = Array.isArray(tasks) ? tasks : []
    const safeWaste = Array.isArray(wasteReports) ? wasteReports : []
    const safeComandas = Array.isArray(comandas) ? comandas : []

    const uSales = safeSales.filter(
      (s) => s.status !== 'cancelado' && (
        (targetId && s.sold_by === targetId) ||
        (s.sold_by_username && String(s.sold_by_username).toLowerCase() === targetUsername) ||
        (s.sold_by_name && String(s.sold_by_name).toLowerCase() === targetUsername)
      )
    )
    const uExpenses = safeExpenses.filter((e) => e.registered_by === targetId || (e.registerer_name && String(e.registerer_name).toLowerCase() === targetUsername))
    const uTasksAssigned = safeTasks.filter((t) => t.assigned_to === targetId || (t.assigned_username && String(t.assigned_username).toLowerCase() === targetUsername))
    const uTasksCompleted = uTasksAssigned.filter((t) => t.completed)
    const uWaste = safeWaste.filter((w) => w.reported_by === targetId || (w.reporter_name && String(w.reporter_name).toLowerCase() === targetUsername))

    let totalRevenue = 0
    const productCounts = {}

    uSales.forEach((s) => {
      totalRevenue += Number(s.total) || 0
      let items = s.items
      if (typeof items === 'string') {
        try { items = JSON.parse(items) } catch (e) { items = [] }
      }
      if (Array.isArray(items)) {
        items.forEach((item) => {
          const pName = item.product_name || item.name || 'Producto'
          const qty = Number(item.quantity) || 1
          productCounts[pName] = (productCounts[pName] || 0) + qty
        })
      }
    })

    const topProductEntry = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]

    let totalExpensesSum = 0
    uExpenses.forEach((e) => {
      totalExpensesSum += Number(e.amount) || 0
    })

    let totalPrepMin = 0
    let prepCount = 0
    safeComandas.forEach((c) => {
      const isMyPrep = (targetId && c.prepared_by === targetId) ||
                       (c.prepared_by_username && String(c.prepared_by_username).toLowerCase() === targetUsername)

      if (isMyPrep && (c.status === 'listo' || c.status === 'entregado') && c.created_at) {
        const end = new Date(c.ready_at || c.updated_at || c.created_at)
        const start = new Date(c.created_at)
        const min = (end - start) / (1000 * 60)
        if (min >= 0 && min < 1440) {
          totalPrepMin += min
          prepCount += 1
        }
      }
    })
    const avgUserPrepMin = prepCount > 0 ? Math.round(totalPrepMin / prepCount) : 0

    return {
      salesCount: uSales.length,
      totalRevenue,
      ticketAverage: uSales.length > 0 ? totalRevenue / uSales.length : 0,
      topProductName: topProductEntry ? topProductEntry[0] : 'Sin ventas',
      topProductQty: topProductEntry ? topProductEntry[1] : 0,
      expensesCount: uExpenses.length,
      totalExpensesSum,
      tasksAssignedCount: uTasksAssigned.length,
      tasksCompletedCount: uTasksCompleted.length,
      wasteCount: uWaste.length,
      avgUserPrepMin,
      recentSales: uSales.slice(0, 5)
    }
  }, [selectedUserForStats, sales, expenses, tasks, wasteReports, comandas])

  const roleBadges = {
    owner: { label: 'DUEÑO', style: 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
    dueño: { label: 'DUEÑO', style: 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
    admin: { label: 'ADMINISTRADOR', style: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
    administrador: { label: 'ADMINISTRADOR', style: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
    employee: { label: 'EMPLEADO', style: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
    empleado: { label: 'EMPLEADO', style: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' }
  }

  const isPrimaryOwner = Boolean(
    editingUser?.is_primary || (editingUser?.username && String(editingUser.username).trim().toLowerCase() === 'camilo osorio')
  )

  if (loading) return <p className="p-4 text-sm font-semibold text-[#9F6839]">Cargando usuarios...</p>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#432414] dark:text-[#FEE4D7] tracking-tight">
            Gestión de Usuarios & Personal
          </h2>
          <p className="text-xs font-semibold text-[#9F6839] dark:text-[#DABA8C] mt-0.5">
            Cuentas, credenciales, rendimiento individual y permisos del equipo Toffee
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#9F6839] hover:bg-[#835229] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {pageError && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{pageError}</span>
        </div>
      )}

      {/* Grid de Tarjetas de Usuario */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {users.map((u) => {
          if (!u) return null
          const isCurrentUser = currentUser?.id === u.id
          const uRole = String(u.role || 'employee').toLowerCase()
          const badge = roleBadges[uRole] || roleBadges.employee
          const rawUAvatar = u.avatar_url || ''
          const uAvatar = processImageUrl(rawUAvatar)
          const uName = String(u.username || 'Usuario').trim()
          const isPrimary = Boolean(u.is_primary || uName.toLowerCase() === 'camilo osorio')
          const initial = uName ? uName.charAt(0).toUpperCase() : 'U'

          return (
            <div
              key={u.id}
              className={`bg-white dark:bg-[#201009] border rounded-3xl p-5 flex flex-col justify-between shadow-xs transition-all ${
                isCurrentUser
                  ? 'border-[#9F6839] ring-2 ring-[#9F6839]/30 shadow-md'
                  : 'border-[#D4B28E]/60 dark:border-[#9F6839]/40 hover:border-[#9F6839]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  {uAvatar ? (
                    <img
                      src={uAvatar}
                      alt={uName}
                      className="w-12 h-12 rounded-2xl object-cover border border-[#D4B28E]/50 shadow-xs"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-[#FEE4D7] dark:bg-[#34180D] text-[#9F6839] dark:text-[#DABA8C] font-extrabold text-xl flex items-center justify-center border border-[#D4B28E]/50">
                      {initial}
                    </div>
                  )}

                  <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border uppercase tracking-wider ${badge.style}`}>
                    {badge.label}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[#432414] dark:text-[#FEE4D7] flex items-center gap-1.5">
                  {uName}
                  {isCurrentUser && (
                    <span className="text-[10px] font-bold bg-[#FEE4D7] text-[#9F6839] px-2 py-0.5 rounded-full border border-[#D4B28E]">
                      (Tú)
                    </span>
                  )}
                </h3>

                <div className="mt-4 pt-3 border-t border-[#D4B28E]/40 dark:border-[#9F6839]/30 space-y-1.5 text-xs text-[#9F6839] dark:text-[#DABA8C]">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#9F6839]" />
                    <span>Permisos: {uRole === 'owner' || uRole === 'dueño' ? 'Acceso Total' : uRole === 'admin' || uRole === 'administrador' ? 'Administración' : 'POS & Ventas'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-[#9F6839]" />
                    <span>Creado: {new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#D4B28E]/40 dark:border-[#9F6839]/30 space-y-2">
                <button
                  onClick={() => openStatsModal(u)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-2xl bg-[#9F6839] hover:bg-[#835229] text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Ver Rendimiento & Stats</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(u)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-2xl bg-[#FEE4D7]/50 dark:bg-[#2E180E] hover:bg-[#D4B28E]/40 text-[#432414] dark:text-[#FEE4D7] border border-[#D4B28E]/60 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#9F6839]" />
                    <span>Editar</span>
                  </button>

                  {!isPrimary && !isCurrentUser && (
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="p-2 rounded-2xl bg-red-50 dark:bg-red-950/40 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 dark:border-red-800 text-xs font-bold transition-all cursor-pointer"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Rendimiento & Stats Personales de Usuario (idéntico a Mi Perfil) */}
      {Boolean(selectedUserForStats) && (
        <UserStatsProfileModal
          selectedUser={selectedUserForStats}
          sales={sales}
          comandas={comandas}
          loading={statsLoading}
          onClose={() => setSelectedUserForStats(null)}
        />
      )}

      {/* Modal Crear / Editar Usuario */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Editar Usuario: ${editingUser.username}` : 'Nuevo Usuario'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
              Nombre de Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. carlos_barista"
              required
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/60 text-sm font-semibold text-[#432414] dark:text-[#FEE4D7]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
              Contraseña {editingUser ? '(Opcional: Vacío para conservar actual)' : '(Mínimo 8 caracteres)'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editingUser ? '•••••••• (vacío para no cambiar)' : 'Escribe una contraseña segura'}
              required={!editingUser}
              minLength={password ? 8 : undefined}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/60 text-sm font-semibold text-[#432414] dark:text-[#FEE4D7]"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#9F6839]" /> Foto de Perfil (Avatar)
            </label>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#FEE4D7] dark:bg-[#2A150C] border border-[#D4B28E] hover:bg-[#9F6839] hover:text-white text-xs font-extrabold text-[#432414] dark:text-[#FEE4D7] transition-all cursor-pointer shadow-xs">
                <Upload className="w-4 h-4" />
                <span>Subir imagen</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-[#9F6839] font-medium">o escribe URL enlace</span>
            </div>

            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://... o foto seleccionada"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/60 text-xs font-semibold text-[#432414] dark:text-[#FEE4D7]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
              Rol de Sistema
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isPrimaryOwner}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/60 text-sm font-semibold text-[#432414] dark:text-[#FEE4D7]"
            >
              <option value="employee">Empleado (Ventas, Comandas, Inventario lectura)</option>
              <option value="admin">Administrador (Acceso completo salvo gestión usuarios)</option>
              <option value="owner">Dueño (Control total del sistema)</option>
            </select>
            {isPrimaryOwner && (
              <p className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                El rol del dueño principal está protegido permanentemente por ID y no se puede modificar.
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-[#D4B28E]/40">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-2xl bg-white dark:bg-[#201009] border border-[#D4B28E] dark:border-[#9F6839] text-xs font-bold text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7]/50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-2xl bg-[#9F6839] hover:bg-[#835229] text-white text-xs font-extrabold shadow-md disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Guardando...' : editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}