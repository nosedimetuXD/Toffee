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
  FileSpreadsheet,
  Wallet,
  BadgeDollarSign,
  CheckCircle2,
  AlertTriangle,
  Plus,
  CreditCard,
  Banknote,
  Calendar,
  Smartphone
} from 'lucide-react'
import { exportCustomersToCSV, exportCustomersToExcel } from '../utils/csvExport'
import { useAuth } from '../context/AuthContext'

const COMMON_BANKS = ['Bre-B/Llave', 'Nequi', 'Daviplata', 'Bancolombia', 'Nu', 'Davivienda', 'BBVA', 'Banco de Bogotá']

export default function Customers() {
  const { user } = useAuth()
  const isOwner = (user?.role || '').toLowerCase() === 'owner' || (user?.role || '').toLowerCase() === 'dueño'
  const isAdmin = (user?.role || '').toLowerCase() === 'admin' || (user?.role || '').toLowerCase() === 'administrador'
  const canSendMessages = isOwner || isAdmin

  const [customers, setCustomers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debtFilter, setDebtFilter] = useState('all') // 'all' | 'with_debt' | 'clean'
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

  // Modal Estado de Cuenta 360
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [selectedAccountCustomer, setSelectedAccountCustomer] = useState(null)
  const [accountSummary, setAccountSummary] = useState(null)
  const [loadingAccount, setLoadingAccount] = useState(false)
  const [accountTab, setAccountTab] = useState('pending') // 'pending' | 'payments'

  // Modal Registrar Abono
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false)
  const [abonoCustomer, setAbonoCustomer] = useState(null)
  const [abonoAmount, setAbonoAmount] = useState('')
  const [abonoMethod, setAbonoMethod] = useState('efectivo')
  const [abonoBank, setAbonoBank] = useState('Bre-B/Llave')
  const [abonoNotes, setAbonoNotes] = useState('')
  const [abonoSubmitting, setAbonoSubmitting] = useState(false)
  const [abonoError, setAbonoError] = useState('')

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

  function handleOpenAbono(customer, e) {
    e?.stopPropagation()
    setAbonoCustomer(customer)
    setAbonoAmount(Number(customer.total_debt) > 0 ? String(customer.total_debt) : '')
    setAbonoMethod('efectivo')
    setAbonoBank('Bre-B/Llave')
    setAbonoNotes('')
    setAbonoError('')
    setIsAbonoModalOpen(true)
  }

  async function handleProcessAbono(e) {
    e.preventDefault()
    if (!abonoCustomer) return
    const val = Number(abonoAmount) || 0
    if (val <= 0) {
      setAbonoError('Ingresa un monto válido mayor a $0.')
      return
    }

    try {
      setAbonoSubmitting(true)
      setAbonoError('')
      const payload = {
        amount: val,
        payment_method: abonoMethod,
        bank_details: abonoMethod !== 'efectivo' ? abonoBank : '',
        notes: abonoNotes.trim()
      }
      await api.post(`/customers/${abonoCustomer.id}/payments`, payload)
      setIsAbonoModalOpen(false)
      await loadData(searchQuery)
      if (isAccountModalOpen && selectedAccountCustomer?.id === abonoCustomer.id) {
        await refreshAccountSummary(abonoCustomer.id)
      }
    } catch (err) {
      console.error('Error registrando abono:', err)
      setAbonoError(err.message || 'Error registrando el abono')
    } finally {
      setAbonoSubmitting(false)
    }
  }

  async function openAccountStatement(customer, e) {
    e?.stopPropagation()
    setSelectedAccountCustomer(customer)
    setIsAccountModalOpen(true)
    setAccountTab('pending')
    setLoadingAccount(true)
    try {
      const data = await api.get(`/customers/${customer.id}/account`)
      setAccountSummary(data)
    } catch (err) {
      console.error('Error cargando estado de cuenta:', err)
    } finally {
      setLoadingAccount(false)
    }
  }

  async function refreshAccountSummary(customerId) {
    try {
      const data = await api.get(`/customers/${customerId}/account`)
      setAccountSummary(data)
    } catch (err) {
      console.error('Error actualizando estado de cuenta:', err)
    }
  }

  function handleSendAccountWhatsApp() {
    if (!selectedAccountCustomer) return
    const phone = (selectedAccountCustomer.phone || '').replace(/\D/g, '')
    const name = `${selectedAccountCustomer.first_name} ${selectedAccountCustomer.last_name || ''}`.trim()
    const debt = accountSummary?.current_debt || 0

    let msg = `*TOFFEE - ESTADO DE CUENTA*\n`
    msg += `¡Hola ${name}! Te compartimos el resumen de tu cuenta:\n\n`
    msg += `• *Total Compras:* $${Number(accountSummary?.total_sales || 0).toLocaleString('es-CO')}\n`
    msg += `• *Total Pagado/Abonado:* $${Number(accountSummary?.total_paid || 0).toLocaleString('es-CO')}\n`
    if (debt > 0) {
      msg += `• *SALDO PENDIENTE POR PAGAR:* $${Number(debt).toLocaleString('es-CO')}\n\n`
      msg += `Agradecemos tu pronto pago. Cualquier duda estamos atentos. ¡Muchas gracias!`
    } else {
      msg += `• *SALDO ACTUAL:* ¡Al día! ($0)\n\n`
      msg += `¡Muchas gracias por tu preferencia en Toffee!`
    }

    const url = phone
      ? `https://wa.me/${phone.startsWith('57') ? phone : '57' + phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`

    window.open(url, '_blank')
  }

  function handleSendAbonoWhatsApp(payment) {
    if (!selectedAccountCustomer) return
    const phone = (selectedAccountCustomer.phone || '').replace(/\D/g, '')
    const name = `${selectedAccountCustomer.first_name} ${selectedAccountCustomer.last_name || ''}`.trim()
    const debt = accountSummary?.current_debt || 0

    let msg = `*TOFFEE - COMPROBANTE DE ABONO*\n`
    msg += `¡Hola ${name}! Registramos tu abono en Toffee con éxito:\n\n`
    msg += `• *Monto Abonado:* $${Number(payment.amount).toLocaleString('es-CO')}\n`
    msg += `• *Método:* ${payment.payment_method.toUpperCase()} ${payment.bank_details ? `(${payment.bank_details})` : ''}\n`
    msg += `• *Fecha:* ${new Date(payment.created_at).toLocaleString('es-CO')}\n`
    msg += `• *Saldo Pendiente Restante:* $${Number(debt).toLocaleString('es-CO')}\n\n`
    msg += `¡Muchas gracias por tu pago!`

    const url = phone
      ? `https://wa.me/${phone.startsWith('57') ? phone : '57' + phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`

    window.open(url, '_blank')
  }

  const totalCustomersCount = customers.length
  const totalSpentAll = useMemo(() => {
    return customers.reduce((sum, c) => sum + (Number(c.total_spent) || 0), 0)
  }, [customers])
  const totalDebtAll = useMemo(() => {
    return customers.reduce((sum, c) => sum + (Number(c.total_debt) || 0), 0)
  }, [customers])
  const withDebtCount = useMemo(() => {
    return customers.filter((c) => Number(c.total_debt) > 0).length
  }, [customers])

  const filteredCustomers = useMemo(() => {
    if (debtFilter === 'with_debt') {
      return customers.filter((c) => Number(c.total_debt) > 0)
    }
    if (debtFilter === 'clean') {
      return customers.filter((c) => Number(c.total_debt) <= 0)
    }
    return customers
  }, [customers, debtFilter])

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEE4D7] dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] rounded-2xl border border-[#D4B28E]/50 dark:border-[#9F6839]/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Total Clientes</span>
            <div className="text-2xl font-black text-[#432414] dark:text-[#FEE4D7]">{totalCustomersCount}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Facturación Total</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${Number(totalSpentAll).toLocaleString('es-CO')}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Deuda Pendiente</span>
            <div className={`text-2xl font-black ${totalDebtAll > 0 ? 'text-red-600 dark:text-red-400' : 'text-[#432414] dark:text-[#FEE4D7]'}`}>
              ${Number(totalDebtAll).toLocaleString('es-CO')}
            </div>
          </div>
        </div>
      </div>

      {/* Buscador y Filtro por Deuda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
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

        {/* Filtro por estado de deuda */}
        <div className="inline-flex p-1 bg-white dark:bg-[#201009] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl shadow-xs shrink-0">
          <button
            type="button"
            onClick={() => setDebtFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              debtFilter === 'all'
                ? 'bg-[#9F6839] text-white shadow-xs'
                : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50'
            }`}
          >
            Todos ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setDebtFilter('with_debt')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              debtFilter === 'with_debt'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
            }`}
          >
            <span>Con Deuda</span>
            {withDebtCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                debtFilter === 'with_debt' ? 'bg-white text-red-600' : 'bg-red-100 text-red-700 dark:bg-red-950'
              }`}>
                {withDebtCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setDebtFilter('clean')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              debtFilter === 'clean'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
            }`}
          >
            Al Día
          </button>
        </div>
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
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-[#9F6839]/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#432414] dark:text-[#FEE4D7] mb-1">
            {searchQuery || debtFilter !== 'all' ? 'No se encontraron clientes con este filtro' : 'Aún no hay clientes registrados'}
          </h3>
          <p className="text-xs text-[#9F6839] dark:text-[#DABA8C] mb-5 max-w-md mx-auto">
            {searchQuery || debtFilter !== 'all'
              ? 'Prueba modificando la búsqueda o el filtro de deuda.'
              : 'Registra los clientes habituales de la cafetería para una atención personalizada.'}
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
          {filteredCustomers.map((c) => {
            const fullName = `${c.first_name} ${c.last_name}`.trim()
            const hasDebt = Number(c.total_debt) > 0

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

                  {/* Badges de Estado (Deuda / Al Día) */}
                  <div className="mb-3 flex items-center gap-2">
                    {hasDebt ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        <span>Debe ${Number(c.total_debt).toLocaleString('es-CO')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Al día</span>
                      </span>
                    )}
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

                  {/* Botones de Acción de Cuenta y Abonos */}
                  <div className="pt-2.5 mb-3 border-t border-[#D4B28E]/30 dark:border-[#9F6839]/20 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => openAccountStatement(c, e)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FEE4D7]/70 dark:bg-[#2A150C] hover:bg-[#9F6839] hover:text-white text-[#9F6839] dark:text-[#DABA8C] font-bold text-xs transition-colors cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Estado de Cuenta</span>
                    </button>

                    {hasDebt && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenAbono(c, e)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-xs transition-all cursor-pointer"
                      >
                        <BadgeDollarSign className="w-3.5 h-3.5" />
                        <span>Abonar</span>
                      </button>
                    )}
                  </div>
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

      {/* MODAL REGISTRAR ABONO */}
      {isAbonoModalOpen && abonoCustomer && (
        <Modal
          isOpen={isAbonoModalOpen}
          onClose={() => !abonoSubmitting && setIsAbonoModalOpen(false)}
          title={`Registrar Abono / Pago: ${abonoCustomer.first_name} ${abonoCustomer.last_name || ''}`}
        >
          <form onSubmit={handleProcessAbono} className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            {abonoError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{abonoError}</span>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs">
              <span className="font-bold text-amber-900 dark:text-amber-200">Deuda actual del cliente:</span>
              <span className="font-black text-sm text-red-600 dark:text-red-400">
                ${Number(abonoCustomer.total_debt || 0).toLocaleString('es-CO')}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Monto del Abono ($) *
              </label>
              <input
                type="number"
                required
                min="1"
                max={Number(abonoCustomer.total_debt) > 0 ? Number(abonoCustomer.total_debt) : undefined}
                value={abonoAmount}
                onChange={(e) => setAbonoAmount(e.target.value)}
                placeholder="Ej. 20000"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-sm font-black text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Método de Abono
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAbonoMethod('efectivo')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    abonoMethod === 'efectivo'
                      ? 'bg-[#9F6839] text-white border-[#9F6839] shadow-xs'
                      : 'bg-white dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Efectivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAbonoMethod('transferencia')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    abonoMethod === 'transferencia'
                      ? 'bg-[#9F6839] text-white border-[#9F6839] shadow-xs'
                      : 'bg-white dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Transferencia</span>
                </button>
              </div>
            </div>

            {abonoMethod === 'transferencia' && (
              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Banco o Billetera
                </label>
                <select
                  value={abonoBank}
                  onChange={(e) => setAbonoBank(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                >
                  {COMMON_BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Notas / Referencia de Pago (Opcional)
              </label>
              <input
                type="text"
                value={abonoNotes}
                onChange={(e) => setAbonoNotes(e.target.value)}
                placeholder="Ej. Abono a cuenta pendiente..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
              <button
                type="button"
                disabled={abonoSubmitting}
                onClick={() => setIsAbonoModalOpen(false)}
                className="px-4 py-2.5 text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={abonoSubmitting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {abonoSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Confirmar Abono</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL ESTADO DE CUENTA 360 */}
      {isAccountModalOpen && selectedAccountCustomer && (
        <Modal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          title={`Estado de Cuenta 360: ${selectedAccountCustomer.first_name} ${selectedAccountCustomer.last_name || ''}`}
        >
          <div className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            {loadingAccount ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#9F6839] dark:text-[#DABA8C]">
                <div className="w-6 h-6 border-2 border-[#9F6839] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold">Cargando estado de cuenta...</span>
              </div>
            ) : (
              <>
                {/* 3 KPIs de la Cuenta */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-2xl bg-[#FEE4D7]/40 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
                    <span className="text-[10px] font-black uppercase text-[#9F6839] dark:text-[#DABA8C]">Total Comprado</span>
                    <p className="text-sm sm:text-base font-black text-[#432414] dark:text-[#FEE4D7] mt-0.5">
                      ${Number(accountSummary?.total_sales || 0).toLocaleString('es-CO')}
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                    <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Total Pagado</span>
                    <p className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      ${Number(accountSummary?.total_paid || 0).toLocaleString('es-CO')}
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50">
                    <span className="text-[10px] font-black uppercase text-red-700 dark:text-red-400">Deuda Actual</span>
                    <p className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 mt-0.5">
                      ${Number(accountSummary?.current_debt || 0).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>

                {/* Acciones Rápidas */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAbono(selectedAccountCustomer)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Registrar Abono / Pago</span>
                  </button>

                  {selectedAccountCustomer.phone && (
                    <button
                      type="button"
                      onClick={handleSendAccountWhatsApp}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all cursor-pointer"
                      title="Enviar estado de cuenta formateado por WhatsApp"
                    >
                      <Send className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </button>
                  )}
                </div>

                {/* Pestañas de Navegación */}
                <div className="flex items-center gap-2 border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30 pb-2">
                  <button
                    type="button"
                    onClick={() => setAccountTab('pending')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      accountTab === 'pending'
                        ? 'bg-[#9F6839] text-white shadow-xs'
                        : 'bg-[#FEE4D7]/40 dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]'
                    }`}
                  >
                    Ventas con Deuda ({(accountSummary?.pending_sales || []).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountTab('payments')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      accountTab === 'payments'
                        ? 'bg-[#9F6839] text-white shadow-xs'
                        : 'bg-[#FEE4D7]/40 dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]'
                    }`}
                  >
                    Historial de Abonos ({(accountSummary?.payment_history || []).length})
                  </button>
                </div>

                {/* Contenido Pestaña 1: Ventas con Deuda */}
                {accountTab === 'pending' && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(accountSummary?.pending_sales || []).length === 0 ? (
                      <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl font-bold">
                        ¡Este cliente no tiene ventas con saldo pendiente! Está al día.
                      </div>
                    ) : (
                      accountSummary.pending_sales.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-[#432414] dark:text-[#FEE4D7]">
                              {s.order_number ? `Orden #${s.order_number}` : `Venta #${s.id}`}
                            </span>
                            <span className="text-[#9F6839] dark:text-[#DABA8C] text-[11px]">
                              {new Date(s.created_at).toLocaleDateString('es-CO')}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-[11px] pt-1 border-t border-[#D4B28E]/30 dark:border-[#9F6839]/20">
                            <div>
                              <span className="text-[#9F6839] dark:text-[#DABA8C] block">Total:</span>
                              <span className="font-black">${Number(s.total).toLocaleString('es-CO')}</span>
                            </div>
                            <div>
                              <span className="text-emerald-700 dark:text-emerald-400 block">Pagado:</span>
                              <span className="font-black text-emerald-600">${Number(s.paid_amount || 0).toLocaleString('es-CO')}</span>
                            </div>
                            <div>
                              <span className="text-red-700 dark:text-red-400 block">Pendiente:</span>
                              <span className="font-black text-red-600">${Number(s.pending_amount || 0).toLocaleString('es-CO')}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Contenido Pestaña 2: Historial de Abonos */}
                {accountTab === 'payments' && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(accountSummary?.payment_history || []).length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#9F6839] dark:text-[#DABA8C] bg-[#FEE4D7]/30 dark:bg-[#2A150C] rounded-2xl font-bold">
                        Aún no se han registrado abonos o pagos para este cliente.
                      </div>
                    ) : (
                      accountSummary.payment_history.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              +${Number(p.amount).toLocaleString('es-CO')}
                            </div>
                            <div className="text-[11px] text-[#9F6839] dark:text-[#DABA8C]">
                              {new Date(p.created_at).toLocaleString('es-CO')} &bull; <span className="capitalize">{p.payment_method}</span> {p.bank_details ? `(${p.bank_details})` : ''}
                            </div>
                            {p.notes && (
                              <div className="text-[10px] text-gray-500 italic mt-0.5">
                                &ldquo;{p.notes}&rdquo;
                              </div>
                            )}
                          </div>

                          {selectedAccountCustomer.phone && (
                            <button
                              type="button"
                              onClick={() => handleSendAbonoWhatsApp(p)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer shrink-0"
                              title="Enviar comprobante del abono por WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="px-5 py-2 bg-white dark:bg-[#2A150C] hover:bg-[#FEE4D7] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
