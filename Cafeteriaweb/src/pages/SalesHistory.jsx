import { useEffect, useState, useMemo } from 'react'
import { api } from '../api/client'
import Modal from '../components/Modal'
import {
  Search,
  FileText,
  Printer,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Trash2,
  Ban,
  MessageCircle,
  CreditCard,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  Wallet,
  Coins,
  MoreVertical
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { exportSalesToCSV, exportSalesToExcel } from '../utils/csvExport'
import { downloadReceiptPDF, printReceiptPDF, shareReceiptPDFToWhatsApp } from '../utils/pdfReceipt'

const MONTH_NAMES = [
  { num: 1, short: 'ene.', full: 'Enero' },
  { num: 2, short: 'feb.', full: 'Febrero' },
  { num: 3, short: 'mar.', full: 'Marzo' },
  { num: 4, short: 'abr.', full: 'Abril' },
  { num: 5, short: 'may.', full: 'Mayo' },
  { num: 6, short: 'jun.', full: 'Junio' },
  { num: 7, short: 'jul.', full: 'Julio' },
  { num: 8, short: 'ago.', full: 'Agosto' },
  { num: 9, short: 'sep.', full: 'Septiembre' },
  { num: 10, short: 'oct.', full: 'Octubre' },
  { num: 11, short: 'nov.', full: 'Noviembre' },
  { num: 12, short: 'dic.', full: 'Diciembre' }
]

export default function SalesHistory() {
  const { user } = useAuth()
  const userRole = String(user?.role || '').toLowerCase()
  const isOwner = userRole === 'owner' || userRole === 'dueño'
  const isAdmin = userRole === 'admin' || userRole === 'administrador'
  const isEmployee = !isOwner && !isAdmin

  const [sales, setSales] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Dropdown Popover de Acciones en Desktop Table
  const [activeActionMenuId, setActiveActionMenuId] = useState(null)

  useEffect(() => {
    function handleClickOutside() {
      setActiveActionMenuId(null)
    }
    if (activeActionMenuId) {
      window.addEventListener('click', handleClickOutside)
      return () => window.removeEventListener('click', handleClickOutside)
    }
  }, [activeActionMenuId])

  // Modal Recibo
  const [selectedSale, setSelectedSale] = useState(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [expandedSaleId, setExpandedSaleId] = useState(null)

  // Modal Editar Venta (Exclusivo Dueño)
  const [editingSale, setEditingSale] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    customer_name: '',
    payment_method: 'efectivo',
    cash_amount: 0,
    transfer_amount: 0,
    bank_details: '',
    discount_percent: 0,
    discount_amount: 0,
    discount_reason: '',
    items: []
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // Filtros de Fecha
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('preset')
  const [displayLabel, setDisplayLabel] = useState(isEmployee ? 'Hoy' : 'Histórico Total')
  const [period, setPeriod] = useState(isEmployee ? 'today' : 'all')
  const [debtStatusFilter, setDebtStatusFilter] = useState('all') // 'all' | 'debt' | 'paid'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  async function loadSales(params = {}) {
    setLoading(true)
    setPageError('')
    try {
      let queryStr = ''
      const targetPeriod = params.period || period
      if (isEmployee) {
        queryStr = `period=${targetPeriod === 'week' ? 'week' : 'today'}`
      } else if (params.startDate && params.endDate) {
        queryStr = `start_date=${params.startDate}&end_date=${params.endDate}`
      } else if (params.year && params.monthNum) {
        queryStr = `year=${params.year}&month_num=${params.monthNum}`
      } else {
        queryStr = `period=${targetPeriod}`
      }

      const data = await api.get(`/sales?${queryStr}`)
      setSales(Array.isArray(data) ? data : [])
    } catch (err) {
      setPageError('No se pudo cargar el historial de ventas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isEmployee) {
      setPeriod('today')
      setDisplayLabel('Hoy')
      loadSales({ period: 'today' })
    } else {
      loadSales({ period: 'all' })
    }
  }, [isEmployee])

  function handleSelectPreset(presetKey, label) {
    setPeriod(presetKey)
    setDisplayLabel(label)
    setIsFilterModalOpen(false)
    loadSales({ period: presetKey })
  }

  function handleSelectMonthYear(year, monthNum, monthFull) {
    setSelectedYear(year)
    setSelectedMonth(monthNum)
    setDisplayLabel(`${monthFull} de ${year}`)
    setIsFilterModalOpen(false)
    loadSales({ year, monthNum })
  }

  function handleApplyCustomRange(e) {
    e.preventDefault()
    if (!startDate || !endDate) {
      alert('Por favor selecciona una fecha de inicio y de fin')
      return
    }
    setDisplayLabel(`${startDate} al ${endDate}`)
    setIsFilterModalOpen(false)
    loadSales({ startDate, endDate })
  }

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchSearch =
        (s.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.sold_by_username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (String(s.order_number || '')).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (String(s.id || '')).toLowerCase().includes(searchQuery.toLowerCase())

      const matchMethod = selectedMethod === 'Todos' || s.payment_method === selectedMethod

      let matchDebt = true
      if (debtStatusFilter === 'debt') {
        matchDebt = Number(s.pending_amount) > 0 || s.payment_status === 'pending' || s.payment_status === 'partial' || s.payment_method === 'credito'
      } else if (debtStatusFilter === 'paid') {
        matchDebt = Number(s.pending_amount) <= 0 && s.payment_status !== 'pending' && s.payment_status !== 'partial' && s.payment_method !== 'credito'
      }

      return matchSearch && matchMethod && matchDebt
    })
  }, [sales, searchQuery, selectedMethod, debtStatusFilter])

  // Estadísticas Header
  const activeSales = useMemo(() => {
    return filteredSales.filter((s) => s.status !== 'cancelado' && s.status !== 'cancelada')
  }, [filteredSales])

  const totalBilled = useMemo(() => {
    return activeSales.reduce((sum, s) => sum + (s.total || 0), 0)
  }, [activeSales])

  const totalCollectedInCash = useMemo(() => {
    return activeSales.reduce((sum, s) => {
      if (s.payment_method === 'credito') return sum
      if (s.cash_amount !== undefined && s.cash_amount !== null && s.cash_amount > 0) {
        return sum + Number(s.cash_amount)
      }
      if (s.payment_method === 'efectivo') {
        return sum + Number(s.paid_amount !== undefined ? s.paid_amount : s.total)
      }
      return sum
    }, 0)
  }, [activeSales])

  const totalCollectedInTransfer = useMemo(() => {
    return activeSales.reduce((sum, s) => {
      if (s.payment_method === 'credito') return sum
      if (s.transfer_amount !== undefined && s.transfer_amount !== null && s.transfer_amount > 0) {
        return sum + Number(s.transfer_amount)
      }
      if (s.payment_method === 'transferencia') {
        return sum + Number(s.paid_amount !== undefined ? s.paid_amount : s.total)
      }
      return sum
    }, 0)
  }, [activeSales])

  const totalPendingDebt = useMemo(() => {
    return activeSales.reduce((sum, s) => {
      if (s.pending_amount !== undefined && s.pending_amount !== null) {
        return sum + Number(s.pending_amount)
      }
      if (s.payment_method === 'credito') {
        return sum + Number(s.total)
      }
      return sum
    }, 0)
  }, [activeSales])

  const totalSalesCount = activeSales.length

  const averageTicket = useMemo(() => {
    return totalSalesCount > 0 ? Math.round(totalBilled / totalSalesCount) : 0
  }, [totalBilled, totalSalesCount])

  // Manejo de Cancelación (Abierto a cualquier usuario)
  async function handleCancelSale(sale) {
    const customerLabel = sale.customer_name || 'Cliente General'
    if (!window.confirm(`¿Confirmas la cancelación de la venta de ${customerLabel} por $${Number(sale.total).toLocaleString('es-CO')}? La comanda pasará a cancelada.`)) return
    try {
      await api.post(`/sales/${sale.id}/cancel`)
      await loadSales({ period })
    } catch (err) {
      alert(err.message || 'No se pudo cancelar la venta')
    }
  }

  // Manejo de Eliminación (Solo Dueño)
  async function handleDeleteSale(sale) {
    if (!isOwner) return
    if (!window.confirm(`¿Eliminar definitivamente la venta #${sale.id.substring(0, 8)}? Se devolverán los insumos al inventario.`)) return
    try {
      await api.delete(`/sales/${sale.id}`)
      setSales((prev) => prev.filter((s) => s.id !== sale.id))
    } catch (err) {
      alert(err.message || 'Error al eliminar la venta')
    }
  }

  // Manejo de Edición (Solo Dueño)
  function handleOpenEditSale(sale) {
    if (!isOwner) return
    setEditingSale(sale)
    setEditFormData({
      customer_name: sale.customer_name || '',
      payment_method: sale.payment_method || 'efectivo',
      cash_amount: sale.cash_amount || (sale.payment_method === 'efectivo' ? sale.total : 0),
      transfer_amount: sale.transfer_amount || (sale.payment_method === 'transferencia' ? sale.total : 0),
      bank_details: sale.bank_details || '',
      discount_percent: sale.discount_percent || 0,
      discount_amount: sale.discount_amount || 0,
      discount_reason: sale.discount_reason || '',
      items: (sale.items || []).map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        notes: ''
      }))
    })
    setIsEditModalOpen(true)
  }

  async function handleSaveEditSale(e) {
    e.preventDefault()
    if (!editingSale) return
    try {
      setSavingEdit(true)
      const payload = {
        customer_name: editFormData.customer_name,
        payment_method: editFormData.payment_method,
        cash_amount: Number(editFormData.cash_amount) || 0,
        transfer_amount: Number(editFormData.transfer_amount) || 0,
        bank_details: editFormData.bank_details,
        discount_percent: Number(editFormData.discount_percent) || 0,
        discount_amount: Number(editFormData.discount_amount) || 0,
        discount_reason: editFormData.discount_reason,
        items: editFormData.items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          notes: ''
        }))
      }

      await api.put(`/sales/${editingSale.id}`, payload)
      setIsEditModalOpen(false)
      loadSales({ period })
    } catch (err) {
      alert('Error actualizando venta: ' + (err.message || 'Error interno'))
    } finally {
      setSavingEdit(false)
    }
  }

  function handleOpenReceiptModal(sale) {
    setSelectedSale(sale)
    setIsReceiptOpen(true)
  }

  return (
    <div className="space-y-6 text-[#432414] dark:text-[#FEE4D7]">
      {/* Cabecera Principal y Filtros */}
      <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#432414] dark:text-[#FEE4D7]">
                Historial de Ventas
              </h1>
              <p className="text-xs text-[#9F6839] dark:text-[#DABA8C] mt-0.5">
                Auditoría de transacciones, tickets y comprobantes
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Selector de Periodo */}
          {isEmployee ? (
            <div className="inline-flex p-1 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setPeriod('today')
                  setDisplayLabel('Hoy')
                  loadSales({ period: 'today' })
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  period === 'today'
                    ? 'bg-[#9F6839] text-white shadow-xs'
                    : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriod('week')
                  setDisplayLabel('Esta Semana')
                  loadSales({ period: 'week' })
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  period === 'week'
                    ? 'bg-[#9F6839] text-white shadow-xs'
                    : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50'
                }`}
              >
                Esta Semana
              </button>
            </div>
          ) : (
            <button type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#2A150C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] text-[#432414] dark:text-[#FEE4D7] rounded-2xl text-xs font-bold transition-colors cursor-pointer border border-[#D4B28E]/70 dark:border-[#9F6839]/40 shadow-xs"
            >
              <Calendar className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
              <span>{displayLabel}</span>
              <ChevronDown className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
            </button>
          )}

          {/* Exportar a Excel & CSV (Exclusivo Dueño / Administrador) */}
          {!isEmployee && (
            <div className="inline-flex items-center p-1 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl shadow-xs">
              <button type="button"
                onClick={() => exportSalesToExcel(filteredSales)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                title="Descargar reporte de ventas en formato Excel (.xls)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Excel</span>
              </button>
              <div className="h-3.5 w-px bg-[#D4B28E]/60 dark:bg-[#9F6839]/40 mx-0.5" />
              <button type="button"
                onClick={() => exportSalesToCSV(filteredSales)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] rounded-xl transition-all cursor-pointer whitespace-nowrap"
                title="Descargar en formato CSV"
              >
                <Download className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
                <span>CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Unified Metrics Bar — Compact 2:1 Hero Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Compact Hero Metric Card */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C]">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 opacity-70" />
                <span>Total Facturado</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {displayLabel}
              </span>
            </div>
            <div className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-[#432414] dark:text-[#FEE4D7] tabular-nums">
              ${Number(totalBilled).toLocaleString('es-CO')}
            </div>
            <p className="text-[11px] text-[#9F6839]/70 dark:text-[#DABA8C]/70 mt-0.5">
              Ingreso bruto acumulado por ventas en el período seleccionado
            </p>
          </div>

          {/* Sub-breakdown row at bottom */}
          <div className="mt-3 pt-2.5 border-t border-[#D4B28E]/20 dark:border-[#9F6839]/20 grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C] block">
                Efectivo
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#432414] dark:text-[#FEE4D7] tabular-nums">
                ${Number(totalCollectedInCash).toLocaleString('es-CO')}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C] block">
                Transferencias
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#432414] dark:text-[#FEE4D7] tabular-nums">
                ${Number(totalCollectedInTransfer).toLocaleString('es-CO')}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C] block">
                Ticket Promedio
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#432414] dark:text-[#FEE4D7] tabular-nums">
                ${Number(averageTicket).toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Stacked Secondary Metric Cards */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          {/* Card 1: Recaudado en Caja */}
          <div className="flex-1 bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C] block">
                Recaudado en Caja
              </span>
              <div className="text-base sm:text-lg font-black tracking-tight text-[#432414] dark:text-[#FEE4D7] tabular-nums mt-0.5">
                ${Number(totalCollectedInCash + totalCollectedInTransfer).toLocaleString('es-CO')}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#FEE4D7]/50 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/30">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: Por Cobrar (Cartera) */}
          <div className="flex-1 bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C] block">
                Por Cobrar (Cartera)
              </span>
              <div className={`text-base sm:text-lg font-black tracking-tight tabular-nums mt-0.5 ${totalPendingDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#432414] dark:text-[#FEE4D7]'}`}>
                ${Number(totalPendingDebt).toLocaleString('es-CO')}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#FEE4D7]/50 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/30">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Transacciones */}
          <div className="flex-1 bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C] block">
                Transacciones
              </span>
              <div className="text-base sm:text-lg font-black tracking-tight text-[#432414] dark:text-[#FEE4D7] tabular-nums mt-0.5">
                {totalSalesCount} <span className="text-xs font-normal text-[#9F6839] dark:text-[#DABA8C]">ventas</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#FEE4D7]/50 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/30">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9F6839] dark:text-[#DABA8C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, vendedor o ID..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] placeholder-[#9F6839]/60 dark:placeholder-[#DABA8C]/50 focus:outline-none focus:border-[#9F6839]"
          />
        </div>

        {/* Filtro por Método de Pago */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {['Todos', 'efectivo', 'transferencia', 'mixto', 'credito'].map((m) => (
            <button type="button"
              key={m}
              onClick={() => setSelectedMethod(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-all cursor-pointer ${
                selectedMethod === m
                  ? 'bg-[#9F6839] text-white font-bold'
                  : 'bg-white dark:bg-[#1E0F08] text-[#432414] dark:text-[#FEE4D7] border border-[#D4B28E]/40 dark:border-[#9F6839]/30 hover:bg-[#FEE4D7]/40 dark:hover:bg-[#2A160D]'
              }`}
            >
              {m === 'credito' ? 'Crédito' : m}
            </button>
          ))}
        </div>

        {/* Filtro por Estado de Deuda */}
        <div className="inline-flex p-0.5 bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/40 dark:border-[#9F6839]/30 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setDebtStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
              debtStatusFilter === 'all'
                ? 'bg-[#9F6839] text-white font-bold'
                : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 font-medium'
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setDebtStatusFilter('debt')}
            className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
              debtStatusFilter === 'debt'
                ? 'bg-[#9F6839] text-white font-bold'
                : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 font-medium'
            }`}
          >
            Con Deuda
          </button>
          <button
            type="button"
            onClick={() => setDebtStatusFilter('paid')}
            className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
              debtStatusFilter === 'paid'
                ? 'bg-[#9F6839] text-white font-bold'
                : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 font-medium'
            }`}
          >
            Pagadas
          </button>
        </div>
      </div>

      {/* Tabla & Cards Responsive de Ventas (Guide 3: Images 3, 4 & 2 Layout) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#9F6839] dark:text-[#DABA8C] gap-3">
          <div className="w-6 h-6 border-2 border-[#9F6839] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Cargando transacciones...</span>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-[#9F6839]/40 dark:text-[#DABA8C]/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#432414] dark:text-[#FEE4D7] mb-1">No hay ventas registradas</h3>
          <p className="text-xs text-[#9F6839] dark:text-[#DABA8C]">No se encontraron transacciones para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-2xl overflow-hidden shadow-xs">
          {/* MOBILE VIEW (Images 3 & 4: Avatar bubble, customer name, status pill dot + date, big amount, tap to expand details & direct actions) */}
          <div className="block md:hidden divide-y divide-[#D4B28E]/20 dark:divide-[#9F6839]/20">
            {filteredSales.map((sale) => {
              const isCancelled = sale.status === 'cancelado' || sale.status === 'cancelada'
              const isExpanded = expandedSaleId === sale.id
              const customerName = sale.customer_name || 'Cliente General'
              const initials = customerName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()

              const paid =
                sale.paid_amount !== undefined && sale.paid_amount !== null
                  ? Number(sale.paid_amount)
                  : sale.payment_method === 'credito'
                  ? 0
                  : Number(sale.total)

              const pending =
                sale.pending_amount !== undefined && sale.pending_amount !== null
                  ? Number(sale.pending_amount)
                  : sale.payment_method === 'credito'
                  ? Number(sale.total)
                  : 0

              const isFullyPaid = !isCancelled && pending === 0
              const isPartial = !isCancelled && paid > 0 && pending > 0
              const itemsList = (sale.items || []).map((it) => `${it.quantity}x ${it.product_name}`).join(', ')

              return (
                <div key={sale.id} className="transition-colors">
                  {/* Clickable Row Header (Image 3) */}
                  <div
                    onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                      isExpanded ? 'bg-[#FEE4D7]/30 dark:bg-[#2A160D]/80' : 'hover:bg-[#FEE4D7]/10'
                    } ${isCancelled ? 'opacity-50' : ''}`}
                  >
                    {/* Left: Avatar Initials + Customer Name & Status */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-[#FEE4D7]/80 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] font-bold text-xs flex items-center justify-center shrink-0 border border-[#D4B28E]/40 dark:border-[#9F6839]/30">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-[#432414] dark:text-[#FEE4D7] truncate">
                          {customerName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {/* Status Dot Badge (Image 3: ● Paid, ● Open, ● Overdue, etc.) */}
                          {isCancelled ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                              Cancelada
                            </span>
                          ) : isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Pagado
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Parcial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Crédito
                            </span>
                          )}
                          <span className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/60 tabular-nums">
                            {new Date(sale.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · {new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Big Bold Tabular Amount & Chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="font-bold text-sm sm:text-base text-[#432414] dark:text-[#FEE4D7] tabular-nums block">
                          ${Number(sale.total).toLocaleString('es-CO')}
                        </span>
                        {pending > 0 && (
                          <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums block">
                            Debe: ${Number(pending).toLocaleString('es-CO')}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-[#9F6839] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Drawer (Image 4: Hidden isn't deleted - Key/Value Details + Action Buttons) */}
                  {isExpanded && (
                    <div className="p-4 bg-[#FEE4D7]/20 dark:bg-[#1A0A04] border-t border-[#D4B28E]/20 dark:border-[#9F6839]/20 space-y-3">
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-[#D4B28E]/15 dark:border-[#9F6839]/15">
                          <span className="text-[#9F6839] dark:text-[#DABA8C]">Comprobante / ID:</span>
                          <span className="font-semibold text-[#432414] dark:text-[#FEE4D7] tabular-nums">#{sale.id.substring(0, 8)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#D4B28E]/15 dark:border-[#9F6839]/15">
                          <span className="text-[#9F6839] dark:text-[#DABA8C]">Método de Pago:</span>
                          <span className="font-semibold text-[#432414] dark:text-[#FEE4D7] uppercase">{sale.payment_method}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#D4B28E]/15 dark:border-[#9F6839]/15">
                          <span className="text-[#9F6839] dark:text-[#DABA8C]">Vendedor / Personal:</span>
                          <span className="font-semibold text-[#432414] dark:text-[#FEE4D7]">{sale.sold_by_username || 'Sistema'}</span>
                        </div>
                        <div className="py-1">
                          <span className="text-[#9F6839] dark:text-[#DABA8C] block mb-1">Detalle de Productos:</span>
                          <p className="font-medium text-[#432414] dark:text-[#FEE4D7] bg-white dark:bg-[#201009] p-2.5 rounded-xl border border-[#D4B28E]/30">
                            {itemsList || 'Sin detalle'}
                          </p>
                        </div>
                      </div>

                      {/* Direct Touch Action Buttons */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleOpenReceiptModal(sale)}
                          className="flex-1 py-2 rounded-xl bg-[#9F6839] hover:bg-[#835229] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Ver Comprobante</span>
                        </button>

                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleCancelSale(sale)}
                            className="px-3 py-2 rounded-xl border border-amber-600/30 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                        )}

                        {isOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditSale(sale)}
                              className="p-2 rounded-xl border border-[#D4B28E]/40 text-[#9F6839] hover:bg-[#FEE4D7]/60 transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSale(sale)}
                              className="p-2 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* DESKTOP TABLE VIEW (Image 2: Linear clean high-density table with 3-dots action menu) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FEE4D7]/30 dark:bg-[#201009] border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30 text-[#9F6839] dark:text-[#DABA8C] font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-2.5 py-2 whitespace-nowrap">ID / Fecha</th>
                  <th className="px-2.5 py-2">Cliente</th>
                  <th className="px-2.5 py-2">Productos</th>
                  <th className="px-2.5 py-2 whitespace-nowrap">Estado</th>
                  <th className="px-2.5 py-2 text-right whitespace-nowrap">Total</th>
                  <th className="px-2.5 py-2 text-right whitespace-nowrap">Cobrado</th>
                  <th className="px-2.5 py-2 text-right whitespace-nowrap">Pendiente</th>
                  <th className="px-2.5 py-2 text-right whitespace-nowrap w-12 min-w-[48px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4B28E]/20 dark:divide-[#9F6839]/20">
                {filteredSales.map((sale) => {
                  const isCancelled = sale.status === 'cancelado' || sale.status === 'cancelada'
                  const paid =
                    sale.paid_amount !== undefined && sale.paid_amount !== null
                      ? Number(sale.paid_amount)
                      : sale.payment_method === 'credito'
                      ? 0
                      : Number(sale.total)

                  const pending =
                    sale.pending_amount !== undefined && sale.pending_amount !== null
                      ? Number(sale.pending_amount)
                      : sale.payment_method === 'credito'
                      ? Number(sale.total)
                      : 0

                  const isFullyPaid = !isCancelled && pending === 0
                  const isPartial = !isCancelled && paid > 0 && pending > 0
                  const itemsList = (sale.items || []).map((it) => `${it.quantity}x ${it.product_name}`).join(', ')
                  const customerName = sale.customer_name || 'Cliente General'
                  const initials = customerName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()

                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-[#FEE4D7]/20 dark:hover:bg-[#2A160D]/70 transition-colors duration-100 group ${
                        isCancelled ? 'opacity-50 bg-[#FEE4D7]/10 dark:bg-[#150904]/40' : ''
                      }`}
                    >
                      {/* ID / Fecha */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap font-medium text-[#432414] dark:text-[#FEE4D7] text-xs">
                        <span className="font-mono text-[11px] text-[#9F6839] dark:text-[#DABA8C] block">
                          #{sale.id.substring(0, 6)}
                        </span>
                        <span className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/60 tabular-nums">
                          {new Date(sale.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · {new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* Cliente (Avatar Bubble + Name) */}
                      <td className="px-2.5 py-1.5 font-semibold text-[#432414] dark:text-[#FEE4D7] text-xs max-w-[130px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-[#FEE4D7]/80 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] font-bold text-[9px] flex items-center justify-center shrink-0 border border-[#D4B28E]/40">
                            {initials}
                          </span>
                          <span className="truncate" title={customerName}>{customerName}</span>
                        </div>
                      </td>

                      {/* Productos (Compact width with tooltip) */}
                      <td
                        className="px-2.5 py-1.5 max-w-[120px] lg:max-w-[140px] truncate text-xs text-[#9F6839] dark:text-[#DABA8C] font-normal"
                        title={itemsList}
                      >
                        {itemsList || 'Sin detalle'}
                      </td>

                      {/* Pago / Estado Minimal Badge */}
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-medium uppercase text-[#9F6839] dark:text-[#DABA8C] px-1 py-0.2 rounded bg-[#FEE4D7]/40 dark:bg-[#2A160D]">
                            {sale.payment_method}
                          </span>
                          {isCancelled ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                              Cancelada
                            </span>
                          ) : isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Pagado
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Parcial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Crédito
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-2.5 py-1.5 text-right font-bold text-[#432414] dark:text-[#FEE4D7] whitespace-nowrap tabular-nums text-xs">
                        ${Number(sale.total).toLocaleString('es-CO')}
                      </td>

                      {/* Cobrado */}
                      <td className="px-2.5 py-1.5 text-right font-normal text-[#432414]/90 dark:text-[#FEE4D7]/90 whitespace-nowrap tabular-nums text-xs">
                        ${Number(paid).toLocaleString('es-CO')}
                      </td>

                      {/* Pendiente */}
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap tabular-nums text-xs">
                        {pending > 0 ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            ${Number(pending).toLocaleString('es-CO')}
                          </span>
                        ) : (
                          <span className="text-[#9F6839]/40 font-normal">$0</span>
                        )}
                      </td>

                      {/* Acciones — Single 3-dots Menu Button (no duplicate receipt button) */}
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap w-12 min-w-[48px]">
                        <div className="flex items-center justify-end">
                          {/* 3-dots Menu Button */}
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveActionMenuId(activeActionMenuId === sale.id ? null : sale.id)
                              }}
                              title="Más opciones"
                              className={`p-1 rounded-md text-[#9F6839] hover:text-[#432414] dark:hover:text-[#FEE4D7] hover:bg-[#FEE4D7]/60 dark:hover:bg-[#34180D] transition-colors cursor-pointer ${
                                activeActionMenuId === sale.id ? 'bg-[#FEE4D7] dark:bg-[#34180D] text-[#432414] dark:text-[#FEE4D7]' : ''
                              }`}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Floating Dropdown Popover */}
                            {activeActionMenuId === sale.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-xl shadow-lg py-1 z-50 text-left animate-in fade-in duration-100"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null)
                                    handleOpenReceiptModal(sale)
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A160D] flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Printer className="w-3.5 h-3.5 text-[#9F6839]" />
                                  <span>Ver Comprobante</span>
                                </button>

                                {!isCancelled && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuId(null)
                                      handleCancelSale(sale)
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Ban className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Cancelar Venta</span>
                                  </button>
                                )}

                                {isOwner && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveActionMenuId(null)
                                        handleOpenEditSale(sale)
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A160D] flex items-center gap-2 cursor-pointer transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-[#9F6839]" />
                                      <span>Editar Venta</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveActionMenuId(null)
                                        handleDeleteSale(sale)
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Eliminar Venta</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL COMPROBANTE / TICKET OFICIAL */}
      {isReceiptOpen && selectedSale && (
        <Modal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          title={`Ticket de Venta #${selectedSale.id.substring(0, 8)}`}
        >
          <div className="space-y-4">
            <div className="p-4 bg-[#FEE4D7]/40 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl text-xs space-y-2 text-[#432414] dark:text-[#FEE4D7]">
              <div className="flex justify-between">
                <span className="text-[#9F6839] dark:text-[#DABA8C] font-bold">Cliente:</span>
                <span className="font-extrabold">{selectedSale.customer_name || 'Cliente General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9F6839] dark:text-[#DABA8C] font-bold">Fecha:</span>
                <span className="font-bold">{new Date(selectedSale.created_at).toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9F6839] dark:text-[#DABA8C] font-bold">Método de Pago:</span>
                <span className="font-bold uppercase">{selectedSale.payment_method}</span>
              </div>
              {selectedSale.bank_details && (
                <div className="flex justify-between">
                  <span className="text-[#9F6839] dark:text-[#DABA8C] font-bold">Bancos:</span>
                  <span className="font-bold">{selectedSale.bank_details}</span>
                </div>
              )}

              {/* Detalle de Productos / Descripcion de la compra */}
              <div className="pt-2.5 pb-1 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
                <div className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] mb-2 uppercase tracking-wider">
                  Productos comprados:
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 divide-y divide-[#D4B28E]/30 dark:divide-[#9F6839]/20">
                  {selectedSale.items && selectedSale.items.length > 0 ? (
                    selectedSale.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center pt-1.5 first:pt-0 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#FEE4D7] dark:bg-[#3E2114] text-[#9F6839] dark:text-[#DABA8C] font-black text-[11px]">
                            {it.quantity}x
                          </span>
                          <span className="font-semibold text-[#432414] dark:text-[#FEE4D7]">
                            {it.product_name || 'Producto'}
                          </span>
                        </div>
                        <span className="font-bold text-right text-[#432414] dark:text-[#FEE4D7]">
                          ${Number((it.unit_price || 0) * it.quantity).toLocaleString('es-CO')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs italic text-[#9F6839] dark:text-[#DABA8C] py-1">
                      Sin detalle de productos registrado
                    </div>
                  )}
                </div>
              </div>

              {(Number(selectedSale.discount_amount) > 0 || Number(selectedSale.discount_percent) > 0) && (
                <div className="flex justify-between text-xs text-red-600 dark:text-red-400 font-bold pt-1">
                  <span>
                    Descuento {Number(selectedSale.discount_percent) > 0 ? `(${selectedSale.discount_percent}%)` : ''}:
                  </span>
                  <span>-${Number(selectedSale.discount_amount || 0).toLocaleString('es-CO')}</span>
                </div>
              )}

              <div className="pt-2 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30 flex justify-between text-sm font-black text-[#432414] dark:text-[#FEE4D7]">
                <span>Total:</span>
                <span className="text-[#9F6839] dark:text-[#DABA8C]">${Number(selectedSale.total).toLocaleString('es-CO')}</span>
              </div>

              {(Number(selectedSale.pending_amount || 0) > 0 || selectedSale.payment_method === 'credito') && (
                <div className="pt-2 border-t border-dashed border-[#D4B28E]/50 dark:border-[#9F6839]/40 flex flex-col gap-1 text-xs">
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Abonado:</span>
                    <span>${Number(selectedSale.paid_amount || 0).toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between text-red-600 dark:text-red-400 font-bold">
                    <span>Saldo pendiente:</span>
                    <span>
                      ${Number(
                        selectedSale.pending_amount !== undefined
                          ? selectedSale.pending_amount
                          : selectedSale.payment_method === 'credito'
                          ? selectedSale.total
                          : 0
                      ).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => printReceiptPDF(selectedSale)}
                className="p-3 bg-white dark:bg-[#2A150C] hover:bg-[#FEE4D7] dark:hover:bg-[#3E2114] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl text-xs font-bold text-[#432414] dark:text-[#FEE4D7] flex flex-col items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
                <span>Imprimir Ticket</span>
              </button>

              <button
                type="button"
                onClick={() => downloadReceiptPDF(selectedSale)}
                className="p-3 bg-white dark:bg-[#2A150C] hover:bg-[#FEE4D7] dark:hover:bg-[#3E2114] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl text-xs font-bold text-[#432414] dark:text-[#FEE4D7] flex flex-col items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
                <span>Descargar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => shareReceiptPDFToWhatsApp(selectedSale)}
                className="p-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex flex-col items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Enviar WhatsApp</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL EDITAR VENTA (DUEÑO) */}
      {isEditModalOpen && editingSale && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => !savingEdit && setIsEditModalOpen(false)}
          title={`Editar Venta #${editingSale.id.substring(0, 8)}`}
        >
          <form onSubmit={handleSaveEditSale} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Cliente
              </label>
              <input
                type="text"
                value={editFormData.customer_name}
                onChange={(e) => setEditFormData({ ...editFormData, customer_name: e.target.value })}
                className="w-full px-3.5 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Método de Pago
                </label>
                <select
                  value={editFormData.payment_method}
                  onChange={(e) => setEditFormData({ ...editFormData, payment_method: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Detalles Banco
                </label>
                <input
                  type="text"
                  value={editFormData.bank_details}
                  onChange={(e) => setEditFormData({ ...editFormData, bank_details: e.target.value })}
                  placeholder="Ej. Nequi: $10.000"
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Descuento (%)
                </label>
                <input
                  type="number"
                  value={editFormData.discount_percent}
                  onChange={(e) => setEditFormData({ ...editFormData, discount_percent: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Motivo Descuento
                </label>
                <input
                  type="text"
                  value={editFormData.discount_reason}
                  onChange={(e) => setEditFormData({ ...editFormData, discount_reason: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                />
              </div>
            </div>

            {/* Ítems */}
            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Cantidades de Productos
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {editFormData.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-[#FEE4D7]/30 dark:bg-[#2A150C] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl text-xs">
                    <span className="font-bold text-[#432414] dark:text-[#FEE4D7]">{it.product_name}</span>
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1
                        const next = [...editFormData.items]
                        next[idx].quantity = val
                        setEditFormData({ ...editFormData, items: next })
                      }}
                      className="w-16 px-2 py-1 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-lg text-center font-bold text-[#432414] dark:text-[#FEE4D7]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-[#9F6839] dark:text-[#DABA8C] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-5 py-2 bg-[#9F6839] hover:bg-[#835229] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL FILTRO DE FECHAS */}
      {!isEmployee && isFilterModalOpen && (
        <Modal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          title="Filtrar Período de Ventas"
        >
          <div className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            <div className="flex items-center gap-2 border-b border-[#D4B28E]/60 dark:border-[#9F6839]/30 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('preset')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'preset'
                    ? 'bg-[#9F6839] text-white'
                    : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50'
                }`}
              >
                Rápidos
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'month'
                    ? 'bg-[#9F6839] text-white'
                    : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50'
                }`}
              >
                Mes Específico
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'custom'
                    ? 'bg-[#9F6839] text-white'
                    : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50'
                }`}
              >
                Rango Libre
              </button>
            </div>

            {activeTab === 'preset' && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'today', label: 'Hoy' },
                  { key: 'week', label: 'Últimos 7 días' },
                  { key: 'month', label: 'Este Mes' },
                  { key: 'prev_month', label: 'Mes Anterior' },
                  { key: 'year', label: 'Este Año' },
                  { key: 'all', label: 'Histórico Total' }
                ].map((item) => (
                  <button type="button"
                    key={item.key}
                    onClick={() => handleSelectPreset(item.key, item.label)}
                    className="p-3 bg-[#FEE4D7]/40 dark:bg-[#2A150C] hover:bg-[#9F6839] hover:text-white border border-[#D4B28E]/60 dark:border-[#9F6839]/30 rounded-xl text-left text-xs font-bold cursor-pointer transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'month' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button type="button"
                    onClick={() => setSelectedYear(selectedYear - 1)}
                    className="p-1 rounded-lg hover:bg-[#FEE4D7]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-extrabold text-sm">{selectedYear}</span>
                  <button type="button"
                    onClick={() => setSelectedYear(selectedYear + 1)}
                    className="p-1 rounded-lg hover:bg-[#FEE4D7]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MONTH_NAMES.map((m) => (
                    <button type="button"
                      key={m.num}
                      onClick={() => handleSelectMonthYear(selectedYear, m.num, m.full)}
                      className="p-2.5 bg-[#FEE4D7]/40 dark:bg-[#2A150C] hover:bg-[#9F6839] hover:text-white border border-[#D4B28E]/60 dark:border-[#9F6839]/30 rounded-xl text-xs font-bold text-center cursor-pointer transition-colors"
                    >
                      {m.full}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'custom' && (
              <form onSubmit={handleApplyCustomRange} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#9F6839] dark:text-[#DABA8C] mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#9F6839] dark:text-[#DABA8C] mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#9F6839] hover:bg-[#835229] text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Aplicar Rango
                </button>
              </form>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
