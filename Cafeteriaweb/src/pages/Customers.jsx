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
  Download,
  ShoppingBag,
  Coffee,
  DollarSign,
  Send,
  AlertCircle,
  X,
  FileSpreadsheet
} from 'lucide-react'
import { exportCustomersToCSV, exportCustomersToExcel } from '../utils/csvExport'
import { useAuth } from '../context/AuthContext'

export default function Customers() {
  const { user } = useAuth()
  const isOwner = (user?.role || '').toLowerCase() === 'owner' || (user?.role || '').toLowerCase() === 'dueño'
  const isAdmin = (user?.role || '').toLowerCase() === 'admin' || (user?.role || '').toLowerCase() === 'administrador'
  const canSendMessages = isOwner || isAdmin

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
    if (!canSendMessages) return
    setWhatsAppCustomer(customer)
    setIsWhatsAppModalOpen(true)
  }

  function sendWhatsAppTemplate(templateKey) {
    if (!canSendMessages) return
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
    <div className="space-y-6 text-[#432414] dark:text-[#FEE4D7]">
      {/* Encabezado Principal */}
      <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-2xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#432414] dark:text-[#FEE4D7]">
                Clientes & CRM
              </h1>
              <p className="text-xs font-semibold text-[#9F6839] dark:text-[#DABA8C] mt-0.5">
                Gestión de clientes habituales, notas de preferencias y fidelización
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Grupo Exportacion */}
          <div className="inline-flex items-center p-1 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl shadow-xs">
            <button
              onClick={() => exportCustomersToExcel(customers)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              title="Descargar listado de clientes en formato Excel (.xls)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
            <div className="h-3.5 w-px bg-[#D4B28E]/60 dark:bg-[#9F6839]/40 mx-0.5" />
            <button
              onClick={() => exportCustomersToCSV(customers)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] rounded-xl transition-all cursor-pointer whitespace-nowrap"
              title="Descargar en formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
              <span>CSV</span>
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#9F6839] hover:bg-[#835229] text-white rounded-2xl text-xs font-black shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEE4D7] dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] rounded-2xl border border-[#D4B28E]/50 dark:border-[#9F6839]/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Total Clientes Registrados</span>
            <div className="text-2xl font-black text-[#432414] dark:text-[#FEE4D7]">{totalCustomersCount}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Facturación Clientes CRM</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${Number(totalSpentAll).toLocaleString('es-CO')}
            </div>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9F6839] dark:text-[#DABA8C]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, teléfono, email o preferencias (ej. leche de avena)..."
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#201009] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl text-xs text-[#432414] dark:text-[#FEE4D7] placeholder-[#9F6839]/60 dark:placeholder-[#DABA8C]/50 focus:outline-none focus:border-[#9F6839] shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9F6839] dark:text-[#DABA8C]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center gap-3 text-xs text-red-600 dark:text-red-400 font-bold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Clientes */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#9F6839] dark:text-[#DABA8C] gap-3">
          <div className="w-8 h-8 border-3 border-[#9F6839] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold">Cargando clientes...</span>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-[#9F6839]/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#432414] dark:text-[#FEE4D7] mb-1">
            {searchQuery ? 'No se encontraron clientes' : 'Aún no hay clientes registrados'}
          </h3>
          <p className="text-xs text-[#9F6839] dark:text-[#DABA8C] mb-5 max-w-md mx-auto">
            {searchQuery
              ? 'Prueba con otro término de búsqueda o registra un nuevo cliente.'
              : 'Registra los clientes habituales de la cafetería con sus gustos y preferencias para una atención personalizada.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#9F6839] hover:bg-[#835229] text-white rounded-2xl text-xs font-bold shadow-md cursor-pointer transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrar Primer Cliente</span>
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
                className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 hover:border-[#9F6839] rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Cabecera Tarjeta */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#FEE4D7] dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] font-black text-base flex items-center justify-center border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
                        {c.first_name?.[0]?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-[#432414] dark:text-[#FEE4D7] text-sm leading-tight group-hover:text-[#9F6839] dark:group-hover:text-[#DABA8C] transition-colors">
                          {fullName}
                        </h3>
                        <span className="text-[11px] text-[#9F6839] dark:text-[#DABA8C] font-medium">
                          Registrado por: {c.created_by_username || 'Personal'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {canSendMessages && c.phone && (
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
                        className="p-2 text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] dark:hover:bg-[#2A150C] rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {(isOwner || isAdmin) && (
                        <button
                          onClick={(e) => handleDeleteCustomer(c, e)}
                          title="Eliminar Cliente"
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Datos de contacto */}
                  <div className="space-y-1.5 mb-3 text-xs text-[#432414]/80 dark:text-[#FEE4D7]/80 font-medium">
                    {c.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Preferencias / Gustos destacados */}
                  {c.notes && (
                    <div className="p-3 bg-[#FEE4D7]/40 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl text-xs text-[#432414] dark:text-[#FEE4D7] mb-3 flex items-start gap-2">
                      <Coffee className="w-4 h-4 flex-shrink-0 text-[#9F6839] dark:text-[#DABA8C] mt-0.5" />
                      <div className="line-clamp-2 italic">
                        &ldquo;{c.notes}&rdquo;
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Tarjeta */}
                <div className="pt-3 border-t border-[#D4B28E]/40 dark:border-[#9F6839]/30 flex items-center justify-between text-xs text-[#9F6839] dark:text-[#DABA8C]">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{c.total_orders || 0} pedidos</span>
                  </div>
                  <div className="font-extrabold text-[#432414] dark:text-[#FEE4D7]">
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
          <form onSubmit={handleSaveCustomer} className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Ej. Camila"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Apellido
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Ej. Gómez"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Teléfono / Celular
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Ej. 3001234567"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Ej. camila@email.com"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Preferencias y Notas del Cliente
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ej. Le gusta el latte con leche de avena, sin azúcar y con canela..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] dark:hover:bg-[#2A150C] rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#9F6839] hover:bg-[#835229] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
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
          <div className="space-y-5 text-[#432414] dark:text-[#FEE4D7]">
            <div className="p-4 bg-[#FEE4D7]/40 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-base font-black">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </h4>
                  <div className="text-xs text-[#9F6839] dark:text-[#DABA8C]">
                    Registrado por: <strong>{selectedCustomer.created_by_username || 'Personal'}</strong> el {new Date(selectedCustomer.created_at).toLocaleDateString('es-CO')}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Total Invertido</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    ${Number(selectedCustomer.total_spent || 0).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {selectedCustomer.notes && (
                <div className="pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30 text-xs flex items-start gap-2">
                  <Coffee className="w-4 h-4 flex-shrink-0 text-[#9F6839] dark:text-[#DABA8C] mt-0.5" />
                  <div>
                    <strong>Preferencias del cliente:</strong> {selectedCustomer.notes}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-black text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider mb-3">
                Historial de Visitas y Compras
              </h4>

              {loadingDetails ? (
                <div className="py-8 text-center text-[#9F6839] dark:text-[#DABA8C] text-xs font-bold">Cargando historial de compras...</div>
              ) : customerSales.length === 0 ? (
                <div className="py-8 text-center text-[#9F6839] dark:text-[#DABA8C] text-xs bg-[#FEE4D7]/30 dark:bg-[#2A150C] rounded-2xl">
                  Este cliente aún no tiene ventas vinculadas.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {customerSales.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-[#FEE4D7]/30 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/30 rounded-2xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold">
                          {new Date(s.created_at).toLocaleString('es-CO')}
                        </div>
                        <div className="text-[#9F6839] dark:text-[#DABA8C] text-[11px] capitalize">
                          Pago: {s.payment_method} {s.bank_details ? `(${s.bank_details})` : ''}
                        </div>
                      </div>
                      <div className="text-right font-extrabold">
                        ${Number(s.total).toLocaleString('es-CO')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
              {canSendMessages && selectedCustomer.phone ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    handleOpenWhatsApp(selectedCustomer)
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Enviar WhatsApp</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2.5 bg-white dark:bg-[#2A150C] hover:bg-[#FEE4D7] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PLANTILLAS WHATSAPP */}
      {canSendMessages && isWhatsAppModalOpen && whatsAppCustomer && (
        <Modal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          title={`Mensaje WhatsApp a ${whatsAppCustomer.first_name}`}
        >
          <div className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            <p className="text-xs text-[#9F6839] dark:text-[#DABA8C]">
              Selecciona una plantilla de 1 clic para abrir WhatsApp con un mensaje personalizado:
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => sendWhatsAppTemplate('saludo')}
                className="w-full text-left p-3.5 bg-[#FEE4D7]/30 dark:bg-[#2A150C] hover:bg-[#9F6839] hover:text-white border border-[#D4B28E]/60 dark:border-[#9F6839]/30 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">
                    Saludo y Agradecimiento
                  </span>
                  <Send className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                </div>
                <p className="text-[11px] opacity-80 line-clamp-2">
                  &ldquo;Hola {whatsAppCustomer.first_name}, te saludamos desde Toffee Coffee. Recuerda que tenemos tu café favorito siempre listo para ti.&rdquo;
                </p>
              </button>

              <button
                onClick={() => sendWhatsAppTemplate('promo')}
                className="w-full text-left p-3.5 bg-[#FEE4D7]/30 dark:bg-[#2A150C] hover:bg-[#9F6839] hover:text-white border border-[#D4B28E]/60 dark:border-[#9F6839]/30 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">
                    Promoción & Descuento Especial
                  </span>
                  <Send className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                </div>
                <p className="text-[11px] opacity-80 line-clamp-2">
                  &ldquo;Hola {whatsAppCustomer.first_name}, presenta este mensaje hoy en tu visita y disfruta de un descuento especial en tu bebida favorita.&rdquo;
                </p>
              </button>

              <button
                onClick={() => sendWhatsAppTemplate('novedad')}
                className="w-full text-left p-3.5 bg-[#FEE4D7]/30 dark:bg-[#2A150C] hover:bg-[#9F6839] hover:text-white border border-[#D4B28E]/60 dark:border-[#9F6839]/30 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">
                    Nuevo Café de Especialidad
                  </span>
                  <Send className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                </div>
                <p className="text-[11px] opacity-80 line-clamp-2">
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
