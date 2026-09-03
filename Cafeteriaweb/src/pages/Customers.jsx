import { useState, useEffect, useMemo } from 'react'
import { api } from '../api/client'
import Modal from '../components/Modal'
import {
  Users,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  FileText,
  MessageCircle,
  Calendar,
  Download,
  ShoppingBag,
  Clock,
  Sparkles,
  Coffee,
  HeartHandshake,
  DollarSign,
  Send,
  Plus,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react'
import { exportCustomersToCSV } from '../utils/csvExport'
import { useAuth } from '../context/AuthContext'

export default function Customers() {
  const { user } = useAuth()
  const isOwner = (user?.role || '').toLowerCase() === 'owner' || (user?.role || '').toLowerCase() === 'dueño'
  const isAdmin = (user?.role || '').toLowerCase() === 'admin' || (user?.role || '').toLowerCase() === 'administrador'

  const [customers, setCustomers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  // Modal Detalle / Historial de Cliente
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSales, setCustomerSales] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Modal Plantillas WhatsApp
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
  const [whatsAppCustomer, setWhatsAppCustomer] = useState(null)

  async function loadData(search = '') {
    try {
      setLoading(true)
      setError('')
      const url = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers'
      const data = await api.get(url)
      setCustomers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error cargando clientes:', err)
      setError('No se pudo cargar la lista de clientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadData(searchQuery)
    }, 250)
    return () => clearTimeout(delayDebounce)
  }, [searchQuery])

  function handleOpenCreate() {
    setEditingCustomer(null)
    setFormData({
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      notes: ''
    })
    setModalError('')
    setIsModalOpen(true)
  }

  function handleOpenEdit(customer, e) {
    e?.stopPropagation()
    setEditingCustomer(customer)
    setFormData({
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || ''
    })
    setModalError('')
    setIsModalOpen(true)
  }

  async function handleSaveCustomer(e) {
    e.preventDefault()
    if (!formData.first_name.trim()) {
      setModalError('El nombre del cliente es obligatorio.')
      return
    }

    try {
      setSaving(true)
      setModalError('')

      if (editingCustomer) {
        const updated = await api.put(`/customers/${editingCustomer.id}`, formData)
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      } else {
        const created = await api.post('/customers', formData)
        setCustomers((prev) => [created, ...prev])
      }

      setIsModalOpen(false)
    } catch (err) {
      console.error('Error guardando cliente:', err)
      setModalError(err.message || 'Error al guardar el cliente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCustomer(customer, e) {
    e?.stopPropagation()
    const fullName = `${customer.first_name} ${customer.last_name}`.trim()
    if (!confirm(`¿Eliminar al cliente "${fullName}"? Esta acción no se puede deshacer.`)) return

    try {
      await api.delete(`/customers/${customer.id}`)
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id))
      if (selectedCustomer?.id === customer.id) {
        setIsDetailModalOpen(false)
      }
    } catch (err) {
      alert('Error eliminando cliente: ' + (err.message || 'Error interno'))
    }
  }

  async function handleOpenDetails(customer) {
    setSelectedCustomer(customer)
    setLoadingDetails(true)
    setIsDetailModalOpen(true)
    try {
      const data = await api.get(`/customers/${customer.id}`)
      if (data?.customer) {
        setSelectedCustomer(data.customer)
        setCustomerSales(data.sales || [])
      } else {
        setCustomerSales([])
      }
    } catch (err) {
      console.error('Error cargando detalles del cliente:', err)
      setCustomerSales([])
    } finally {
      setLoadingDetails(false)
    }
  }

  function handleOpenWhatsApp(customer, e) {
    e?.stopPropagation()
    setWhatsAppCustomer(customer)
    setIsWhatsAppModalOpen(true)
  }

  function sendWhatsAppTemplate(templateKey) {
    if (!whatsAppCustomer || !whatsAppCustomer.phone) {
      alert('El cliente no tiene un teléfono registrado.')
      return
    }

    const cleanPhone = whatsAppCustomer.phone.replace(/\D/g, '')
    const name = whatsAppCustomer.first_name || 'Estimado(a) Cliente'
    let text = ''

    if (templateKey === 'saludo') {
      text = `Hola ${name}, esperamos que estés teniendo un excelente día. Te saludamos desde Toffee Coffee. Recuerda que tenemos tu café favorito siempre listo para ti.`
    } else if (templateKey === 'promo') {
      text = `Hola ${name}, ¡tenemos una sorpresa especial para ti en Toffee Coffee! Presenta este mensaje hoy en tu visita y disfruta de un descuento especial en tu bebida favorita.`
    } else if (templateKey === 'novedad') {
      text = `Hola ${name}, te contamos que en Toffee Coffee acabamos de preparar un nuevo lote de café de especialidad y recetas frescas. Te esperamos pronto para sorprenderte.`
    }

    const url = `https://wa.me/57${cleanPhone.replace(/^57/, '')}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
    setIsWhatsAppModalOpen(false)
  }

  const totalCustomersCount = customers.length
  const totalSpentAll = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.total_spent || 0), 0)
  }, [customers])

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 dark:bg-amber-950/50 rounded-2xl text-amber-800 dark:text-amber-300">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                Clientes & CRM
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                Gestión de clientes habituales, notas de preferencias y fidelización
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => exportCustomersToCSV(customers)}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-2xl text-sm font-bold transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700"
          >
            <Download className="w-4 h-4 text-zinc-500" />
            Exportar CSV
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-2xl text-sm font-bold shadow-lg shadow-amber-700/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Clientes Registrados</span>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{totalCustomersCount}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Facturación Clientes CRM</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${Number(totalSpentAll).toLocaleString('es-CO')}
            </div>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, teléfono, email o preferencias (ej. leche de avena)..."
          className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center gap-3 text-sm text-red-600 dark:text-red-400 font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Clientes */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-3">
          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Cargando clientes...</span>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1">
            {searchQuery ? 'No se encontraron clientes' : 'Aún no hay clientes registrados'}
          </h3>
          <p className="text-sm text-zinc-400 mb-5 max-w-md mx-auto">
            {searchQuery
              ? 'Prueba con otro término de búsqueda o registra un nuevo cliente.'
              : 'Registra los clientes habituales de la cafetería con sus gustos y preferencias para una atención personalizada.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-2xl text-sm font-bold shadow-md cursor-pointer transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Registrar Primer Cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => {
            const fullName = `${c.first_name} ${c.last_name}`.trim()
            return (
              <div
                key={c.id}
                onClick={() => handleOpenDetails(c)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-900/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Cabecera Tarjeta */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-black text-base flex items-center justify-center border border-amber-200/60 dark:border-amber-900/50">
                        {c.first_name?.[0]?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-base leading-tight group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                          {fullName}
                        </h3>
                        <span className="text-xs text-zinc-400 font-medium">
                          Registrado por: {c.created_by_username || 'Personal'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {c.phone && (
                        <button
                          onClick={(e) => handleOpenWhatsApp(c, e)}
                          title="Enviar WhatsApp"
                          className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleOpenEdit(c, e)}
                        title="Editar Cliente"
                        className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {(isOwner || isAdmin) && (
                        <button
                          onClick={(e) => handleDeleteCustomer(c, e)}
                          title="Eliminar Cliente"
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Datos de contacto */}
                  <div className="space-y-1.5 mb-3 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    {c.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Preferencias / Gustos destacados */}
                  {c.notes && (
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 rounded-2xl text-xs text-amber-900 dark:text-amber-200 mb-3 flex items-start gap-2">
                      <Coffee className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
                      <div className="line-clamp-2 italic">
                        &ldquo;{c.notes}&rdquo;
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Tarjeta: Métricas de compras */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{c.total_orders || 0} pedidos</span>
                  </div>
                  <div className="font-extrabold text-zinc-900 dark:text-zinc-100">
                    ${Number(c.total_spent || 0).toLocaleString('es-CO')}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR CLIENTE */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente Habitual'}
        >
          <form onSubmit={handleSaveCustomer} className="space-y-4">
            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Ej. Camila"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Apellido
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Ej. Gómez"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Teléfono / Celular
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Ej. 3001234567"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Ej. camila@email.com"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Preferencias y Notas del Cliente
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ej. Le gusta el latte con leche de avena, sin azúcar y con canela..."
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
              <span className="text-[11px] text-zinc-400">
                Estas notas se mostrarán en la caja (POS) para que los baristas preparen su café favorito al instante.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-sm font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL DETALLE / HISTORIAL CLIENTE */}
      {isDetailModalOpen && selectedCustomer && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Ficha de Cliente: ${selectedCustomer.first_name} ${selectedCustomer.last_name || ''}`}
        >
          <div className="space-y-5">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </h4>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Registrado por: <strong>{selectedCustomer.created_by_username || 'Personal'}</strong> el {new Date(selectedCustomer.created_at).toLocaleDateString('es-CO')}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Invertido</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    ${Number(selectedCustomer.total_spent || 0).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {selectedCustomer.notes && (
                <div className="pt-3 border-t border-amber-200/50 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Coffee className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
                  <div>
                    <strong>Preferencias del cliente:</strong> {selectedCustomer.notes}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-3">
                Historial de Visitas y Compras
              </h4>

              {loadingDetails ? (
                <div className="py-8 text-center text-zinc-400 text-sm">Cargando historial de compras...</div>
              ) : customerSales.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 text-sm bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                  Este cliente aún no tiene ventas vinculadas.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {customerSales.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 rounded-2xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-zinc-800 dark:text-zinc-200">
                          {new Date(s.created_at).toLocaleString('es-CO')}
                        </div>
                        <div className="text-zinc-400 text-[11px] capitalize">
                          Pago: {s.payment_method} {s.bank_details ? `(${s.bank_details})` : ''}
                        </div>
                      </div>
                      <div className="text-right font-extrabold text-zinc-900 dark:text-zinc-100">
                        ${Number(s.total).toLocaleString('es-CO')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
              {selectedCustomer.phone ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleOpenWhatsApp(selectedCustomer)
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Enviar WhatsApp
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PLANTILLAS WHATSAPP */}
      {isWhatsAppModalOpen && whatsAppCustomer && (
        <Modal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          title={`Mensaje WhatsApp a ${whatsAppCustomer.first_name}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Selecciona una plantilla de 1 clic para abrir WhatsApp con un mensaje personalizado:
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => sendWhatsAppTemplate('saludo')}
                className="w-full text-left p-3.5 bg-zinc-50 dark:bg-zinc-800/70 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-zinc-200 dark:border-zinc-700 hover:border-amber-300 dark:hover:border-amber-800 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">
                    Saludo y Agradecimiento
                  </span>
                  <Send className="w-4 h-4 text-zinc-400 group-hover:text-amber-600" />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  &ldquo;Hola {whatsAppCustomer.first_name}, te saludamos desde Toffee Coffee. Recuerda que tenemos tu café favorito siempre listo para ti.&rdquo;
                </p>
              </button>

              <button
                onClick={() => sendWhatsAppTemplate('promo')}
                className="w-full text-left p-3.5 bg-zinc-50 dark:bg-zinc-800/70 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-zinc-200 dark:border-zinc-700 hover:border-amber-300 dark:hover:border-amber-800 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">
                    Promoción & Descuento Especial
                  </span>
                  <Send className="w-4 h-4 text-zinc-400 group-hover:text-amber-600" />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  &ldquo;Hola {whatsAppCustomer.first_name}, presenta este mensaje hoy en tu visita y disfruta de un descuento especial en tu bebida favorita.&rdquo;
                </p>
              </button>

              <button
                onClick={() => sendWhatsAppTemplate('novedad')}
                className="w-full text-left p-3.5 bg-zinc-50 dark:bg-zinc-800/70 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-zinc-200 dark:border-zinc-700 hover:border-amber-300 dark:hover:border-amber-800 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">
                    Nuevo Café de Especialidad
                  </span>
                  <Send className="w-4 h-4 text-zinc-400 group-hover:text-amber-600" />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  &ldquo;Hola {whatsAppCustomer.first_name}, acabamos de preparar un nuevo lote de café de especialidad y recetas frescas. Te esperamos pronto.&rdquo;
                </p>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
