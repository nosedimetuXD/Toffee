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
  FileSpreadsheet
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

  const [sales, setSales] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Modal Recibo
  const [selectedSale, setSelectedSale] = useState(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)

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
  const [displayLabel, setDisplayLabel] = useState('Histórico Total')
  const [period, setPeriod] = useState('all')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  async function loadSales(params = {}) {
    setLoading(true)
    setPageError('')
    try {
      let queryStr = ''
      if (params.startDate && params.endDate) {
        queryStr = `start_date=${params.startDate}&end_date=${params.endDate}`
      } else if (params.year && params.monthNum) {
        queryStr = `year=${params.year}&month_num=${params.monthNum}`
      } else {
        queryStr = `period=${params.period || period}`
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
    loadSales({ period: 'all' })
  }, [])

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
        (s.id || '').toLowerCase().includes(searchQuery.toLowerCase())

      const matchMethod = selectedMethod === 'Todos' || s.payment_method === selectedMethod
      return matchSearch && matchMethod
    })
  }, [sales, searchQuery, selectedMethod])

  // Estadísticas Header
  const activeSales = useMemo(() => {
    return filteredSales.filter((s) => s.status !== 'cancelado' && s.status !== 'cancelada')
  }, [filteredSales])

  const totalBilled = useMemo(() => {
    return activeSales.reduce((sum, s) => sum + (s.total || 0), 0)
  }, [activeSales])

  const totalCollectedInCash = useMemo(() => {
    return activeSales.reduce((sum, s) => sum + (s.cash_amount || (s.payment_method === 'efectivo' ? s.total : 0)), 0)
  }, [activeSales])

  const totalCollectedInTransfer = useMemo(() => {
    return activeSales.reduce((sum, s) => sum + (s.transfer_amount || (s.payment_method === 'transferencia' ? s.total : 0)), 0)
  }, [activeSales])

  const totalSalesCount = activeSales.length

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
      <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-2xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#432414] dark:text-[#FEE4D7]">
                Historial de Ventas
              </h1>
              <p className="text-xs font-semibold text-[#9F6839] dark:text-[#DABA8C] mt-0.5">
                Auditoría de transacciones, tickets y comprobantes
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Selector de Período */}
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#2A150C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] text-[#432414] dark:text-[#FEE4D7] rounded-2xl text-xs font-bold transition-colors cursor-pointer border border-[#D4B28E]/70 dark:border-[#9F6839]/40 shadow-xs"
          >
            <Calendar className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
            <span>{displayLabel}</span>
            <ChevronDown className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
          </button>

          {/* Exportar a Excel & CSV */}
          <div className="inline-flex items-center p-1 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl shadow-xs">
            <button
              onClick={() => exportSalesToExcel(filteredSales)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              title="Descargar reporte de ventas en formato Excel (.xls)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
            <div className="h-3.5 w-px bg-[#D4B28E]/60 dark:bg-[#9F6839]/40 mx-0.5" />
            <button
              onClick={() => exportSalesToCSV(filteredSales)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] rounded-xl transition-all cursor-pointer whitespace-nowrap"
              title="Descargar en formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tarjetas de Métricas Resumen (Sin Deuda) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEE4D7] dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] rounded-2xl border border-[#D4B28E]/50 dark:border-[#9F6839]/30">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Total Facturado</span>
            <div className="text-2xl font-black text-[#432414] dark:text-[#FEE4D7]">
              ${Number(totalBilled).toLocaleString('es-CO')}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Recaudado en Caja</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${Number(totalCollectedInCash + totalCollectedInTransfer).toLocaleString('es-CO')}
            </div>
            <span className="text-[10px] text-[#9F6839] dark:text-[#DABA8C] font-semibold block mt-0.5">
              Efec: ${Number(totalCollectedInCash).toLocaleString('es-CO')} | Transf: ${Number(totalCollectedInTransfer).toLocaleString('es-CO')}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEE4D7] dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] rounded-2xl border border-[#D4B28E]/50 dark:border-[#9F6839]/30">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Ventas Realizadas</span>
            <div className="text-2xl font-black text-[#432414] dark:text-[#FEE4D7]">
              {totalSalesCount}
            </div>
          </div>
        </div>
      </div>

      {/* Buscador y Filtro por Método de Pago */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9F6839] dark:text-[#DABA8C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, vendedor o ID..."
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#201009] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl text-xs text-[#432414] dark:text-[#FEE4D7] placeholder-[#9F6839]/60 dark:placeholder-[#DABA8C]/50 focus:outline-none focus:border-[#9F6839] shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['Todos', 'efectivo', 'transferencia', 'mixto'].map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMethod(m)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold capitalize whitespace-nowrap transition-all cursor-pointer ${
                selectedMethod === m
                  ? 'bg-[#9F6839] text-white shadow-xs'
                  : 'bg-white dark:bg-[#201009] text-[#432414] dark:text-[#FEE4D7] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A150C]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla / Lista de Ventas */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#9F6839] dark:text-[#DABA8C] gap-3">
          <div className="w-8 h-8 border-3 border-[#9F6839] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold">Cargando historial de ventas...</span>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 text-[#9F6839]/50 dark:text-[#DABA8C]/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#432414] dark:text-[#FEE4D7] mb-1">No hay ventas registradas</h3>
          <p className="text-xs text-[#9F6839] dark:text-[#DABA8C]">No se encontraron transacciones para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FEE4D7]/50 dark:bg-[#2A150C] border-b border-[#D4B28E]/60 dark:border-[#9F6839]/30 text-[#9F6839] dark:text-[#DABA8C] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Fecha / ID</th>
                  <th className="px-4 py-3.5">Cliente & Vendedor</th>
                  <th className="px-4 py-3.5">Método de Pago</th>
                  <th className="px-4 py-3.5">Subtotal / Descuento</th>
                  <th className="px-4 py-3.5">Total Pagado</th>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4B28E]/40 dark:divide-[#9F6839]/20">
                {filteredSales.map((sale) => {
                  const isCancelled = sale.status === 'cancelado' || sale.status === 'cancelada'
                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-[#FEE4D7]/30 dark:hover:bg-[#2A150C]/60 transition-colors ${
                        isCancelled ? 'opacity-60 bg-[#FEE4D7]/10 dark:bg-[#150904]/40' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-[#432414] dark:text-[#FEE4D7]">
                          {new Date(sale.created_at).toLocaleDateString('es-CO')}
                        </div>
                        <div className="text-[11px] text-[#9F6839] dark:text-[#DABA8C] font-mono">
                          {new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} • #{sale.id.substring(0, 8)}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-extrabold text-[#432414] dark:text-[#FEE4D7]">
                          {sale.customer_name || 'Cliente General'}
                        </div>
                        <div className="text-[11px] text-[#9F6839] dark:text-[#DABA8C]">
                          Vendido por: <strong>{sale.sold_by_username || 'Personal'}</strong>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-block px-2.5 py-1 rounded-xl bg-[#FEE4D7] dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] font-bold uppercase text-[10px] border border-[#D4B28E]/60 dark:border-[#9F6839]/30">
                          {sale.payment_method}
                        </span>
                        {sale.bank_details && (
                          <div className="text-[10px] text-[#9F6839] dark:text-[#DABA8C] truncate max-w-xs mt-0.5">
                            {sale.bank_details}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-[#432414] dark:text-[#FEE4D7] font-medium">
                          ${Number(sale.subtotal || sale.total).toLocaleString('es-CO')}
                        </div>
                        {(sale.discount_amount > 0 || sale.discount_percent > 0) && (
                          <div className="text-red-600 dark:text-red-400 text-[11px] font-bold">
                            -${Number(sale.discount_amount).toLocaleString('es-CO')} ({sale.discount_percent}%)
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-sm font-black text-[#432414] dark:text-[#FEE4D7]">
                          ${Number(sale.total).toLocaleString('es-CO')}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            isCancelled
                              ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40'
                              : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40'
                          }`}
                        >
                          {isCancelled ? 'Cancelada' : 'Completada'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Ver Comprobante */}
                          <button
                            onClick={() => handleOpenReceiptModal(sale)}
                            title="Ver / Imprimir Comprobante"
                            className="p-2 text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] dark:hover:bg-[#2A150C] rounded-xl transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Cancelar Venta (Accesible para cualquier usuario) */}
                          {!isCancelled && (
                            <button
                              onClick={() => handleCancelSale(sale)}
                              title="Cancelar Venta"
                              className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-xl transition-colors cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Editar Venta (Exclusivo Dueño) */}
                          {isOwner && (
                            <button
                              onClick={() => handleOpenEditSale(sale)}
                              title="Editar Venta (Dueño)"
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Eliminar Venta (Exclusivo Dueño) */}
                          {isOwner && (
                            <button
                              onClick={() => handleDeleteSale(sale)}
                              title="Eliminar Venta Definitivamente (Dueño)"
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
              <div className="pt-2 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30 flex justify-between text-sm font-black text-[#432414] dark:text-[#FEE4D7]">
                <span>Total:</span>
                <span className="text-[#9F6839] dark:text-[#DABA8C]">${Number(selectedSale.total).toLocaleString('es-CO')}</span>
              </div>
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
      {isFilterModalOpen && (
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
                  <button
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
                  <button
                    onClick={() => setSelectedYear(selectedYear - 1)}
                    className="p-1 rounded-lg hover:bg-[#FEE4D7]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-extrabold text-sm">{selectedYear}</span>
                  <button
                    onClick={() => setSelectedYear(selectedYear + 1)}
                    className="p-1 rounded-lg hover:bg-[#FEE4D7]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MONTH_NAMES.map((m) => (
                    <button
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
