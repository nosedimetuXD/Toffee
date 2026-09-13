import { useEffect, useState } from 'react'
import { api } from '../api/client'
import Modal from '../components/Modal'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Award,
  Users,
  Calendar,
  CalendarDays,
  Building2,
  AlertTriangle,
  Trophy,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Zap,
  Sun,
  Globe
} from 'lucide-react'

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

export default function Stats() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Control de filtro y modal
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('month_year')
  const [displayLabel, setDisplayLabel] = useState('Mes Actual')

  // Estados de filtro
  const [period, setPeriod] = useState('month')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  async function loadStats(params = {}) {
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

      const data = await api.get(`/accounting/summary?${queryStr}`)
      setSummary(data)
    } catch (err) {
      setPageError('No se pudieron cargar las estadísticas del período seleccionado')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats({ period: 'month' })
  }, [])

  function handleSelectPreset(presetKey, label) {
    setPeriod(presetKey)
    setDisplayLabel(label)
    setIsFilterModalOpen(false)
    loadStats({ period: presetKey })
  }

  function handleSelectMonthYear(year, monthNum, monthFull) {
    setSelectedYear(year)
    setSelectedMonth(monthNum)
    setDisplayLabel(`${monthFull} de ${year}`)
    setIsFilterModalOpen(false)
    loadStats({ year, monthNum })
  }

  function handleApplyCustomRange(e) {
    e.preventDefault()
    if (!startDate || !endDate) {
      alert('Por favor selecciona una fecha de inicio y de fin')
      return
    }
    setDisplayLabel(`${startDate} al ${endDate}`)
    setIsFilterModalOpen(false)
    loadStats({ startDate, endDate })
  }

  const mStats = summary?.monthly_stats

  return (
    <div className="space-y-6 text-[#432414] dark:text-[#FEE4D7]">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#432414] dark:text-[#FEE4D7]">
              Estadísticas Ejecutivas & Reportes
            </h1>
            <p className="text-xs text-[#9F6839] dark:text-[#DABA8C] mt-0.5">
              Dashboard de rendimiento financiero, productos estrella y clientes top
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsFilterModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-[#2A150C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] text-[#432414] dark:text-[#FEE4D7] rounded-xl text-xs font-semibold border border-[#D4B28E]/70 dark:border-[#9F6839]/40 shadow-xs transition-colors cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
          <span>{displayLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
        </button>
      </div>

      {pageError && (
        <div className="p-3.5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      {/* Unified Metrics Bar — Linear Style (Single container, hero hierarchy) */}
      <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-2xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#D4B28E]/20 dark:divide-[#9F6839]/20 overflow-hidden">
        {/* Ganancia Neta — Hero Metric */}
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C]">
            <span>Ganancia Neta</span>
            <DollarSign className="w-3.5 h-3.5 opacity-60" />
          </div>
          <div className={`mt-1 text-3xl sm:text-4xl font-black tracking-tight tabular-nums ${(mStats?.net_profit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ${(mStats?.net_profit || 0).toLocaleString('es-CO')}
          </div>
          <span className="text-[11px] text-[#9F6839]/70 dark:text-[#DABA8C]/70 font-normal mt-1">
            Utilidad operativa neta del período
          </span>
        </div>

        {/* Ventas Totales */}
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C]">
            <span>Ventas Totales</span>
            <TrendingUp className="w-3.5 h-3.5 opacity-60" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[#432414] dark:text-[#FEE4D7] tabular-nums">
            ${(mStats?.monthly_income || 0).toLocaleString('es-CO')}
          </div>
          <span className="text-[11px] text-[#9F6839]/70 dark:text-[#DABA8C]/70 font-normal mt-1">
            Ingreso bruto facturado en el período
          </span>
        </div>

        {/* Gastos Totales */}
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C]">
            <span>Gastos Totales</span>
            <TrendingDown className="w-3.5 h-3.5 opacity-60 text-rose-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[#432414] dark:text-[#FEE4D7] tabular-nums">
            ${(mStats?.monthly_expenses || 0).toLocaleString('es-CO')}
          </div>
          <span className="text-[11px] text-[#9F6839]/70 dark:text-[#DABA8C]/70 font-normal mt-1">
            Egresos e insumos del período
          </span>
        </div>
      </div>

      {/* Rankings Grid: Top 10 Productos Más Vendidos y Top 10 Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top 10 Productos Más Vendidos */}
        <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#D4B28E]/20 dark:border-[#9F6839]/20">
            <h3 className="text-xs font-semibold text-[#432414] dark:text-[#FEE4D7] flex items-center gap-2 uppercase tracking-wider">
              <Award className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
              <span>Top 10 Productos Más Vendidos</span>
            </h3>
            <span className="text-[11px] text-[#9F6839]/70 dark:text-[#DABA8C]/70">Por unidades</span>
          </div>

          {!mStats?.top_products || mStats.top_products.length === 0 ? (
            <p className="text-xs text-[#9F6839]/70 dark:text-[#DABA8C]/70 py-6 text-center">No hay productos vendidos en este periodo.</p>
          ) : (
            <div className="divide-y divide-[#D4B28E]/15 dark:divide-[#9F6839]/15 max-h-[380px] overflow-y-auto pr-1">
              {mStats.top_products.slice(0, 10).map((prod, idx) => (
                <div key={prod.product_name || idx} className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-[#FEE4D7]/20 dark:hover:bg-[#2A160D]/50 transition-colors rounded-lg">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded text-[11px] font-semibold text-[#9F6839] dark:text-[#DABA8C] bg-[#FEE4D7]/50 dark:bg-[#2A160D] border border-[#D4B28E]/40 dark:border-[#9F6839]/30 flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium text-[#432414] dark:text-[#FEE4D7] truncate">{prod.product_name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-[#432414] dark:text-[#FEE4D7] block tabular-nums">{prod.total_qty} ud(s)</span>
                    <span className="text-[11px] text-[#9F6839]/80 dark:text-[#DABA8C]/70 tabular-nums">${prod.total_amount.toLocaleString('es-CO')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 10 Clientes del Periodo */}
        <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#D4B28E]/20 dark:border-[#9F6839]/20">
            <h3 className="text-xs font-semibold text-[#432414] dark:text-[#FEE4D7] flex items-center gap-2 uppercase tracking-wider">
              <Users className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
              <span>Top 10 Clientes del Periodo</span>
            </h3>
            <span className="text-[11px] text-[#9F6839]/70 dark:text-[#DABA8C]/70">Por facturación</span>
          </div>

          {!mStats?.top_customers || mStats.top_customers.length === 0 ? (
            <p className="text-xs text-[#9F6839]/70 dark:text-[#DABA8C]/70 py-6 text-center">No hay compras registradas con nombre de cliente este mes.</p>
          ) : (
            <div className="divide-y divide-[#D4B28E]/15 dark:divide-[#9F6839]/15 max-h-[380px] overflow-y-auto pr-1">
              {mStats.top_customers.slice(0, 10).map((c, idx) => (
                <div key={c.customer_name || idx} className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-[#FEE4D7]/20 dark:hover:bg-[#2A160D]/50 transition-colors rounded-lg">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded text-[11px] font-semibold text-[#9F6839] dark:text-[#DABA8C] bg-[#FEE4D7]/50 dark:bg-[#2A160D] border border-[#D4B28E]/40 dark:border-[#9F6839]/30 flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium text-[#432414] dark:text-[#FEE4D7] truncate">{c.customer_name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-[#432414] dark:text-[#FEE4D7] block tabular-nums">${c.total_spent.toLocaleString('es-CO')}</span>
                    <span className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/70 tabular-nums">{c.orders_count} compra(s)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal / Popover de Filtro de Período y Fechas */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Filtrar Período & Fechas de Estadísticas"
      >
        <div className="space-y-5">
          {/* Navegación por pestañas */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#FEE4D7]/50 dark:bg-[#2E180E] border border-[#D4B28E]">
            <button
              type="button"
              onClick={() => setActiveTab('month_year')}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'month_year'
                  ? 'bg-[#9F6839] text-white shadow-xs'
                  : 'text-[#432414] dark:text-[#FEE4D7] hover:bg-[#9F6839]/10'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Mes & Año</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'custom'
                  ? 'bg-[#9F6839] text-white shadow-xs'
                  : 'text-[#432414] dark:text-[#FEE4D7] hover:bg-[#9F6839]/10'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Rango Calendario</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preset')}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'preset'
                  ? 'bg-[#9F6839] text-white shadow-xs'
                  : 'text-[#432414] dark:text-[#FEE4D7] hover:bg-[#9F6839]/10'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Rápido</span>
            </button>
          </div>

          {/* TAB 1: Mes & Año */}
          {activeTab === 'month_year' && (
            <div className="space-y-4 p-4 rounded-xl bg-white dark:bg-[#150904] border border-[#D4B28E]/40 shadow-xs">
              {/* Selector de Año */}
              <div className="flex items-center justify-between pb-3 border-b border-[#D4B28E]/30">
                <button
                  type="button"
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  className="p-1.5 rounded-lg border border-[#D4B28E]/50 hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2E180E] text-[#432414] dark:text-[#FEE4D7] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-[#432414] dark:text-[#FEE4D7] tabular-nums">
                  {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  className="p-1.5 rounded-lg border border-[#D4B28E]/50 hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2E180E] text-[#432414] dark:text-[#FEE4D7] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Grid de 12 Meses */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {MONTH_NAMES.map((m) => {
                  const isSelected = selectedMonth === m.num

                  return (
                    <button
                      key={m.num}
                      type="button"
                      onClick={() => handleSelectMonthYear(selectedYear, m.num, m.full)}
                      className={`py-2 px-1 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#9F6839] text-white shadow-xs'
                          : 'bg-[#FEE4D7]/30 dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7] dark:hover:bg-[#34180D] border border-[#D4B28E]/30 dark:border-[#9F6839]/30'
                      }`}
                    >
                      {m.short}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Rango Calendario (Fecha Inicio - Fecha Fin) */}
          {activeTab === 'custom' && (
            <form onSubmit={handleApplyCustomRange} className="space-y-4 p-4 rounded-3xl bg-white dark:bg-[#150904] border border-[#D4B28E]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase mb-1">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] text-xs font-bold text-[#432414] dark:text-[#FEE4D7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase mb-1">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] text-xs font-bold text-[#432414] dark:text-[#FEE4D7]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#9F6839] hover:bg-[#835229] text-white text-xs font-extrabold shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <Filter className="w-4 h-4" />
                <span>Aplicar Rango de Fechas</span>
              </button>
            </form>
          )}

          {/* TAB 3: Opciones Rápidas */}
          {activeTab === 'preset' && (
            <div className="grid grid-cols-2 gap-3 p-1">
              <button
                type="button"
                onClick={() => handleSelectPreset('month', 'Mes Actual')}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] hover:bg-[#FEE4D7]/50 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] text-left cursor-pointer flex items-center gap-2"
              >
                <Calendar className="w-4 h-4 text-[#9F6839]" />
                <span>Mes Actual</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('prev_month', 'Mes Anterior')}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] hover:bg-[#FEE4D7]/50 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] text-left cursor-pointer flex items-center gap-2"
              >
                <Clock className="w-4 h-4 text-[#9F6839]" />
                <span>Mes Anterior</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('week', 'Esta Semana')}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] hover:bg-[#FEE4D7]/50 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] text-left cursor-pointer flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4 text-[#9F6839]" />
                <span>Esta Semana</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('today', 'Hoy')}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] hover:bg-[#FEE4D7]/50 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] text-left cursor-pointer flex items-center gap-2"
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Hoy</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('year', 'Este Año')}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] hover:bg-[#FEE4D7]/50 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] text-left cursor-pointer flex items-center gap-2"
              >
                <Building2 className="w-4 h-4 text-[#9F6839]" />
                <span>Este Año</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('all', 'Histórico Total')}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] hover:bg-[#FEE4D7]/50 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] text-left cursor-pointer flex items-center gap-2"
              >
                <Globe className="w-4 h-4 text-blue-600" />
                <span>Histórico Total</span>
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
