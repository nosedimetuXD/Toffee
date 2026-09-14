import { useEffect, useState, useMemo } from 'react'
import { api } from '../api/client'
import Modal from '../components/Modal'
import { AVAILABLE_UNITS, convertQuantity } from '../utils/unitConverter'
import {
  DollarSign,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Zap,
  Wrench,
  Building2,
  Users,
  Trash2,
  Edit2,
  Download,
  AlertCircle,
  Tag,
  ShoppingBag,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react'
import { exportAccountingToCSV, exportAccountingToExcel } from '../utils/csvExport'
import { useAuth } from '../context/AuthContext'

const EXPENSE_CATEGORIES = [
  { value: 'insumos', label: 'Insumos / Café / Ingredientes', icon: Package },
  { value: 'servicios', label: 'Servicios Públicos (Luz/Agua/Gas)', icon: Zap },
  { value: 'mantenimiento', label: 'Mantenimiento & Reparaciones', icon: Wrench },
  { value: 'nomina', label: 'Nómina / Sueldos', icon: Users },
  { value: 'arriendo', label: 'Arriendo del Local', icon: Building2 },
  { value: 'otros', label: 'Otros Gastos Operativos', icon: Tag }
]

const INCOME_CATEGORIES = [
  { value: 'eventos', label: 'Eventos & Catering', icon: Users },
  { value: 'propinas', label: 'Propinas Generales', icon: DollarSign },
  { value: 'otros', label: 'Otros Ingresos Extraordinarios', icon: Tag }
]

export default function Accounting() {
  const { user } = useAuth()
  const isOwner = (user?.role || '').toLowerCase() === 'owner' || (user?.role || '').toLowerCase() === 'dueño'

  const [summary, setSummary] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [activeTab, setActiveTab] = useState('expenses') // 'expenses' | 'incomes'
  const [period, setPeriod] = useState('month') // 'today' | 'week' | 'month' | 'year' | 'all'
  const [incomeFilter, setIncomeFilter] = useState('all') // 'all' | 'sale' | 'manual'
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [expandedExpenseId, setExpandedExpenseId] = useState(null)
  const [expandedIncomeId, setExpandedIncomeId] = useState(null)

  // Modal Crear / Editar Gasto
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'insumos',
    payment_method: 'efectivo',
    created_at: '',
    ingredient_id: '',
    quantity_added: '',
    unit: 'g'
  })
  const [expenseSubmitting, setExpenseSubmitting] = useState(false)
  const [expenseError, setExpenseError] = useState('')

  // Modal Crear / Editar Ingreso
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [incomeForm, setIncomeForm] = useState({
    description: '',
    amount: '',
    category: 'otros',
    payment_method: 'efectivo',
    created_at: ''
  })
  const [incomeSubmitting, setIncomeSubmitting] = useState(false)
  const [incomeError, setIncomeError] = useState('')

  async function loadData() {
    setLoading(true)
    setPageError('')
    try {
      const [sumData, expData, ingData, incData] = await Promise.all([
        api.get(`/accounting/summary?period=${period}`).catch(() => null),
        api.get(`/expenses?period=${period}`).catch(() => []),
        api.get('/ingredients').catch(() => []),
        api.get(`/incomes?period=${period}`).catch(() => [])
      ])
      setSummary(sumData)
      setExpenses(Array.isArray(expData) ? expData : [])
      setIngredients(Array.isArray(ingData) ? ingData : [])
      setIncomes(Array.isArray(incData) ? incData : [])
    } catch (err) {
      console.error('Error cargando contabilidad:', err)
      setPageError('No se pudo cargar la información de contabilidad')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [period])

  function handleOpenCreateExpense() {
    setEditingExpense(null)
    setExpenseForm({
      description: '',
      amount: '',
      category: 'insumos',
      payment_method: 'efectivo',
      created_at: new Date().toISOString().substring(0, 16),
      ingredient_id: '',
      quantity_added: '',
      unit: 'g'
    })
    setExpenseError('')
    setIsExpenseModalOpen(true)
  }

  function handleOpenEditExpense(exp) {
    setEditingExpense(exp)
    setExpenseForm({
      description: exp.description || '',
      amount: exp.amount || '',
      category: exp.category || 'insumos',
      payment_method: exp.payment_method || 'efectivo',
      created_at: exp.created_at ? new Date(exp.created_at).toISOString().substring(0, 16) : '',
      ingredient_id: exp.ingredient_id || '',
      quantity_added: exp.quantity_added || '',
      unit: 'g'
    })
    setExpenseError('')
    setIsExpenseModalOpen(true)
  }

  async function handleSaveExpense(e) {
    e.preventDefault()
    const amt = parseFloat(expenseForm.amount)
    if (!expenseForm.description.trim() || isNaN(amt) || amt <= 0) {
      setExpenseError('Ingresa una descripción y un monto válido.')
      return
    }

    try {
      setExpenseSubmitting(true)
      setExpenseError('')

      let qtyStandard = 0
      if (expenseForm.ingredient_id && expenseForm.quantity_added) {
        const rawQty = parseFloat(expenseForm.quantity_added)
        const targetIng = ingredients.find((i) => i.id === expenseForm.ingredient_id)
        if (targetIng) {
          qtyStandard = convertQuantity(rawQty, expenseForm.unit, targetIng.unit)
        }
      }

      const payload = {
        description: expenseForm.description.trim(),
        amount: amt,
        category: expenseForm.category,
        payment_method: expenseForm.payment_method,
        created_at: expenseForm.created_at ? new Date(expenseForm.created_at).toISOString() : undefined,
        ingredient_id: expenseForm.ingredient_id || undefined,
        quantity_added: qtyStandard > 0 ? qtyStandard : undefined
      }

      if (editingExpense) {
        await api.put(`/expenses/${editingExpense.id}`, payload)
      } else {
        await api.post('/expenses', payload)
      }

      setIsExpenseModalOpen(false)
      loadData()
    } catch (err) {
      setExpenseError(err.message || 'Error guardando gasto')
    } finally {
      setExpenseSubmitting(false)
    }
  }

  async function handleDeleteExpense(exp) {
    if (!isOwner) return
    if (!confirm(`¿Eliminar el gasto "${exp.description}" por $${Number(exp.amount).toLocaleString('es-CO')}?`)) return
    try {
      await api.delete(`/expenses/${exp.id}`)
      setExpenses((prev) => prev.filter((e) => e.id !== exp.id))
    } catch (err) {
      alert('Error eliminando gasto: ' + (err.message || 'Error'))
    }
  }

  function handleOpenCreateIncome() {
    setEditingIncome(null)
    setIncomeForm({
      description: '',
      amount: '',
      category: 'otros',
      payment_method: 'efectivo',
      created_at: new Date().toISOString().substring(0, 16)
    })
    setIncomeError('')
    setIsIncomeModalOpen(true)
  }

  function handleOpenEditIncome(inc) {
    setEditingIncome(inc)
    setIncomeForm({
      description: inc.description || '',
      amount: inc.amount || '',
      category: inc.category || 'otros',
      payment_method: inc.payment_method || 'efectivo',
      created_at: inc.created_at ? new Date(inc.created_at).toISOString().substring(0, 16) : ''
    })
    setIncomeError('')
    setIsIncomeModalOpen(true)
  }

  async function handleSaveIncome(e) {
    e.preventDefault()
    const amt = parseFloat(incomeForm.amount)
    if (!incomeForm.description.trim() || isNaN(amt) || amt <= 0) {
      setIncomeError('Ingresa una descripción y un monto válido.')
      return
    }

    try {
      setIncomeSubmitting(true)
      setIncomeError('')

      const payload = {
        description: incomeForm.description.trim(),
        amount: amt,
        category: incomeForm.category,
        payment_method: incomeForm.payment_method,
        created_at: incomeForm.created_at ? new Date(incomeForm.created_at).toISOString() : undefined
      }

      if (editingIncome) {
        await api.put(`/incomes/${editingIncome.id}`, payload)
      } else {
        await api.post('/incomes', payload)
      }

      setIsIncomeModalOpen(false)
      loadData()
    } catch (err) {
      setIncomeError(err.message || 'Error guardando ingreso')
    } finally {
      setIncomeSubmitting(false)
    }
  }

  async function handleDeleteIncome(inc) {
    if (!isOwner) return
    if (!confirm(`¿Eliminar el ingreso "${inc.description}" por $${Number(inc.amount).toLocaleString('es-CO')}?`)) return
    try {
      await api.delete(`/incomes/${inc.id}`)
      setIncomes((prev) => prev.filter((i) => i.id !== inc.id))
    } catch (err) {
      alert('Error eliminando ingreso: ' + (err.message || 'Error'))
    }
  }

  const salesIncomes = useMemo(() => incomes.filter((i) => i.type === 'sale'), [incomes])
  const manualIncomes = useMemo(() => incomes.filter((i) => (i.type || 'manual') === 'manual'), [incomes])

  const salesIncomesCount = salesIncomes.length
  const manualIncomesCount = manualIncomes.length

  const salesIncomeTotal = useMemo(() => salesIncomes.reduce((sum, i) => sum + (i.amount || 0), 0), [salesIncomes])
  const manualIncomeTotal = useMemo(() => manualIncomes.reduce((sum, i) => sum + (i.amount || 0), 0), [manualIncomes])

  const totalIngresosCalc = useMemo(() => {
    return summary?.total_income ?? (salesIncomeTotal + manualIncomeTotal)
  }, [summary, salesIncomeTotal, manualIncomeTotal])

  const totalGastosCalc = useMemo(() => {
    return summary?.total_expenses ?? expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  }, [summary, expenses])

  const balanceNetoCalc = totalIngresosCalc - totalGastosCalc
  const margenOperativo = totalIngresosCalc > 0 ? Math.round((balanceNetoCalc / totalIngresosCalc) * 100) : 0

  const filteredIncomes = useMemo(() => {
    if (incomeFilter === 'all') return incomes
    return incomes.filter((inc) => (inc.type || 'manual') === incomeFilter)
  }, [incomes, incomeFilter])

  return (
    <div className="space-y-6 text-[#432414] dark:text-[#FEE4D7]">
      {/* Header Principal */}
      <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#432414] dark:text-[#FEE4D7]">
                Contabilidad & Flujo de Caja
              </h1>
              <p className="text-xs text-[#9F6839] dark:text-[#DABA8C] mt-0.5">
                Control de ingresos, gastos clasificados, balance neto y exportación contable.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Grupo Exportacion */}
          <div className="inline-flex items-center p-0.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-xl shadow-xs">
            <button type="button"
              onClick={() => exportAccountingToExcel(expenses, incomes)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-all cursor-pointer whitespace-nowrap"
              title="Descargar en formato Excel (.xls)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
            <div className="h-3.5 w-px bg-[#D4B28E]/40 dark:bg-[#9F6839]/40 mx-0.5" />
            <button type="button"
              onClick={() => exportAccountingToCSV(expenses, incomes)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] rounded-lg transition-all cursor-pointer whitespace-nowrap"
              title="Descargar en formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
              <span>CSV</span>
            </button>
          </div>

          {/* Grupo Acciones Principales */}
          <div className="inline-flex items-center gap-2">
            <button type="button"
              onClick={handleOpenCreateIncome}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Ingreso</span>
            </button>

            <button type="button"
              onClick={handleOpenCreateExpense}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#9F6839] hover:bg-[#835229] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Gasto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unified Metrics Bar — Compact 2:1 Hero Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Large Hero Box (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-xs relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C]">
                Ganancia Neta
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${balanceNetoCalc >= 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${balanceNetoCalc >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {balanceNetoCalc >= 0 ? 'Balance Positivo' : 'Déficit'}
              </span>
            </div>

            <div className={`mt-1 text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${balanceNetoCalc >= 0 ? 'text-[#432414] dark:text-[#FEE4D7]' : 'text-rose-600 dark:text-rose-400'}`}>
              ${Number(balanceNetoCalc).toLocaleString('es-CO')}
            </div>
            <p className="text-[11px] text-[#9F6839]/70 dark:text-[#DABA8C]/70 mt-0.5 font-normal">
              Balance neto consolidado del período seleccionado
            </p>
          </div>

          {/* Sub-breakdown 3 columns at bottom */}
          <div className="mt-3 pt-2.5 border-t border-[#D4B28E]/20 dark:border-[#9F6839]/20 grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] font-semibold text-[#9F6839] dark:text-[#DABA8C] block uppercase tracking-wider">
                Ventas POS
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#432414] dark:text-[#FEE4D7] tabular-nums block mt-0.5">
                ${Number(salesIncomeTotal).toLocaleString('es-CO')}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#9F6839] dark:text-[#DABA8C] block uppercase tracking-wider">
                Ingresos Extras
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#432414] dark:text-[#FEE4D7] tabular-nums block mt-0.5">
                ${Number(manualIncomeTotal).toLocaleString('es-CO')}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#9F6839] dark:text-[#DABA8C] block uppercase tracking-wider">
                Egresos / Gastos
              </span>
              <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums block mt-0.5">
                -${Number(totalGastosCalc).toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        </div>

        {/* Stacked Side Cards (1 col) */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl p-2.5 sm:p-3 flex-1 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C]">
              <span>Ingresos Totales</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="my-0.5 text-base sm:text-lg font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              +${Number(totalIngresosCalc).toLocaleString('es-CO')}
            </div>
            <span className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/70 font-normal">
              {incomes.length} ingresos registrados
            </span>
          </div>

          <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl p-2.5 sm:p-3 flex-1 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C]">
              <span>Gastos Totales</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="my-0.5 text-base sm:text-lg font-black tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
              -${Number(totalGastosCalc).toLocaleString('es-CO')}
            </div>
            <span className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/70 font-normal">
              {expenses.length} egresos clasificados
            </span>
          </div>

          <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl p-2.5 sm:p-3 flex-1 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#9F6839] dark:text-[#DABA8C]">
              <span>Margen Operativo</span>
              <Wallet className="w-3.5 h-3.5 opacity-60" />
            </div>
            <div className="my-0.5 text-base sm:text-lg font-black tracking-tight text-[#432414] dark:text-[#FEE4D7] tabular-nums">
              {margenOperativo}%
            </div>
            <span className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/70 font-normal">
              Rentabilidad estimada del período
            </span>
          </div>
        </div>
      </div>

      {/* Tabs y Periodos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30 pb-2">
        <div className="flex items-center gap-1">
          <button type="button"
            onClick={() => setActiveTab('expenses')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-[#9F6839] text-white font-bold'
                : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A160D]'
            }`}
          >
            Gastos ({expenses.length})
          </button>
          <button type="button"
            onClick={() => setActiveTab('incomes')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'incomes'
                ? 'bg-[#9F6839] text-white font-bold'
                : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A160D]'
            }`}
          >
            Ingresos ({incomes.length})
          </button>
        </div>

        {/* Selector de Periodo */}
        <div className="flex items-center gap-1 bg-white dark:bg-[#1E0F08] p-0.5 rounded-lg border border-[#D4B28E]/40 dark:border-[#9F6839]/30 self-start sm:self-auto overflow-x-auto">
          {[
            { id: 'today', label: 'Hoy' },
            { id: 'week', label: '7 Días' },
            { id: 'month', label: 'Este Mes' },
            { id: 'year', label: 'Este Año' },
            { id: 'all', label: 'Todo' }
          ].map((p) => (
            <button type="button"
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer whitespace-nowrap ${
                period === p.id
                  ? 'bg-[#9F6839] text-white font-bold'
                  : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 font-medium'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB GASTOS */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-2xl overflow-hidden">
          {expenses.length === 0 ? (
            <div className="p-12 text-center text-[#9F6839] dark:text-[#DABA8C]">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-xs">No hay gastos registrados</p>
            </div>
          ) : (
            <>
              {/* MOBILE VIEW FOR GASTOS (Images 3 & 4: Avatar bubble + Status dot + Expandable drawer) */}
              <div className="block md:hidden divide-y divide-[#D4B28E]/20 dark:divide-[#9F6839]/20">
                {expenses.map((e) => {
                  const isExpanded = expandedExpenseId === e.id
                  const catInitials = (e.category || 'GA').substring(0, 2).toUpperCase()

                  return (
                    <div key={e.id} className="transition-colors">
                      {/* Compact Tappable Summary Row */}
                      <div
                        onClick={() => setExpandedExpenseId(isExpanded ? null : e.id)}
                        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FEE4D7]/15 transition-colors select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Avatar Initials Bubble */}
                          <div className="w-9 h-9 rounded-full bg-[#FEE4D7]/70 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] font-black text-xs flex items-center justify-center border border-[#D4B28E]/40 dark:border-[#9F6839]/30 shrink-0">
                            {catInitials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-[#432414] dark:text-[#FEE4D7] truncate">
                              {e.description}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#9F6839] dark:text-[#DABA8C]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#9F6839]" />
                                {e.category}
                              </span>
                              <span className="text-[10px] text-[#9F6839]/60 dark:text-[#DABA8C]/50 tabular-nums">
                                · {new Date(e.created_at).toLocaleDateString('es-CO')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Amount & Chevron */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                            -${Number(e.amount).toLocaleString('es-CO')}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-[#9F6839] dark:text-[#DABA8C] transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expandable Accordion Drawer ("Hidden isn't deleted") */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-[#FEE4D7]/10 dark:bg-[#201009]/50 border-t border-[#D4B28E]/20 dark:border-[#9F6839]/20 space-y-3 animate-in fade-in duration-150">
                          {/* Metadata Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded-xl bg-white/70 dark:bg-[#150904]/70 border border-[#D4B28E]/30 dark:border-[#9F6839]/20">
                              <span className="text-[10px] uppercase font-semibold text-[#9F6839] dark:text-[#DABA8C] block">
                                Método de Pago
                              </span>
                              <span className="font-medium text-[#432414] dark:text-[#FEE4D7] capitalize block mt-0.5">
                                {e.payment_method}
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-white/70 dark:bg-[#150904]/70 border border-[#D4B28E]/30 dark:border-[#9F6839]/20">
                              <span className="text-[10px] uppercase font-semibold text-[#9F6839] dark:text-[#DABA8C] block">
                                Registrado Por
                              </span>
                              <span className="font-medium text-[#432414] dark:text-[#FEE4D7] block mt-0.5 truncate">
                                {e.registerer_name || 'Personal'}
                              </span>
                            </div>
                          </div>

                          {e.ingredient_name && (
                            <div className="p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-500/20 text-xs">
                              <span className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400 block">
                                Reabastecimiento de Insumo
                              </span>
                              <span className="font-medium text-emerald-800 dark:text-emerald-300 block mt-0.5">
                                +{e.quantity_added} agregados al stock de {e.ingredient_name}
                              </span>
                            </div>
                          )}

                          <div className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/60 tabular-nums">
                            Fecha y hora exacta: {new Date(e.created_at).toLocaleString('es-CO')}
                          </div>

                          {/* Action Buttons Full Width */}
                          {isOwner && (
                            <div className="flex items-center gap-2 pt-2 border-t border-[#D4B28E]/20 dark:border-[#9F6839]/20">
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  handleOpenEditExpense(e)
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FEE4D7]/80 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] text-xs font-bold transition-all cursor-pointer shadow-xs"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Editar Gasto</span>
                              </button>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  handleDeleteExpense(e)
                                }}
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* DESKTOP VIEW FOR GASTOS (Image 2: Linear Table) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FEE4D7]/30 dark:bg-[#201009] border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30 text-[#9F6839] dark:text-[#DABA8C] uppercase font-semibold text-[11px] tracking-wider">
                    <tr>
                      <th className="px-2.5 py-2 whitespace-nowrap">Fecha</th>
                      <th className="px-2.5 py-2">Descripción & Categoría</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Método de Pago</th>
                      <th className="px-2.5 py-2">Insumo Reabastecido</th>
                      <th className="px-2.5 py-2 text-right whitespace-nowrap">Monto</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Registrado Por</th>
                      <th className="px-2.5 py-2 text-right whitespace-nowrap w-20 min-w-[70px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4B28E]/20 dark:divide-[#9F6839]/20">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-[#FEE4D7]/20 dark:hover:bg-[#2A160D]/70 transition-colors duration-100 group">
                        <td className="px-2.5 py-1.5 font-medium text-[#432414] dark:text-[#FEE4D7] whitespace-nowrap text-xs">
                          <span className="tabular-nums">{new Date(e.created_at).toLocaleDateString('es-CO')}</span>
                          <span className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/60 font-normal tabular-nums ml-1">
                            {new Date(e.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5">
                          <div className="font-semibold text-[#432414] dark:text-[#FEE4D7] text-xs">{e.description}</div>
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-md bg-[#FEE4D7]/60 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] text-[10px] font-medium uppercase border border-[#D4B28E]/40 dark:border-[#9F6839]/30">
                            {e.category}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 capitalize text-[#432414] dark:text-[#FEE4D7] font-normal text-xs">
                          {e.payment_method}
                        </td>
                        <td className="px-2.5 py-1.5">
                          {e.ingredient_name ? (
                            <div className="text-[#432414] dark:text-[#FEE4D7] font-medium text-xs">
                              {e.ingredient_name}
                              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] block tabular-nums">+{e.quantity_added} agregados</span>
                            </div>
                          ) : (
                            <span className="text-[#9F6839]/40">-</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 font-bold text-rose-600 dark:text-rose-400 text-xs text-right tabular-nums whitespace-nowrap">
                          -${Number(e.amount).toLocaleString('es-CO')}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#9F6839] dark:text-[#DABA8C] font-normal text-xs">
                          {e.registerer_name || 'Personal'}
                        </td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap w-20 min-w-[70px]">
                          {isOwner && (
                            <div className="flex items-center justify-end gap-1">
                              <button type="button"
                                onClick={() => handleOpenEditExpense(e)}
                                className="p-1 text-[#9F6839] hover:text-[#432414] dark:hover:text-[#FEE4D7] hover:bg-[#FEE4D7]/60 dark:hover:bg-[#34180D] rounded-md transition-colors cursor-pointer"
                                title="Editar Gasto"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button"
                                onClick={() => handleDeleteExpense(e)}
                                className="p-1 text-[#9F6839] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                                title="Eliminar Gasto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB INGRESOS */}
      {activeTab === 'incomes' && (
        <div className="bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-2xl overflow-hidden">
          {/* Sub-filtros de Tipo de Ingreso */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#FEE4D7]/20 dark:bg-[#201009] border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30">
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'all', label: `Todos (${incomes.length})` },
                { id: 'sale', label: `Ventas POS (${salesIncomesCount})` },
                { id: 'manual', label: `Ingresos Extras (${manualIncomesCount})` }
              ].map((f) => (
                <button type="button"
                  key={f.id}
                  onClick={() => setIncomeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    incomeFilter === f.id
                      ? 'bg-[#9F6839] text-white font-bold'
                      : 'bg-white dark:bg-[#1E0F08] text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A160D] border border-[#D4B28E]/40 dark:border-[#9F6839]/30'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button type="button"
              onClick={handleOpenCreateIncome}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9F6839] hover:bg-[#835229] text-white font-semibold text-xs cursor-pointer ml-auto whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Ingreso Extra</span>
            </button>
          </div>

          {filteredIncomes.length === 0 ? (
            <div className="p-12 text-center text-[#9F6839] dark:text-[#DABA8C]">
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-xs">No hay ingresos registrados</p>
            </div>
          ) : (
            <>
              {/* MOBILE VIEW FOR INGRESOS */}
              <div className="block md:hidden divide-y divide-[#D4B28E]/20 dark:divide-[#9F6839]/20">
                {filteredIncomes.map((inc) => {
                  const isSale = inc.type === 'sale'
                  const isManual = !isSale
                  const isExpanded = expandedIncomeId === `${inc.type || 'inc'}-${inc.id}`
                  const initials = (isSale ? 'POS' : inc.description ? inc.description.substring(0, 2) : 'EX').toUpperCase()

                  return (
                    <div key={`${inc.type || 'inc'}-${inc.id}`} className="transition-colors">
                      {/* Compact Tappable Summary Row */}
                      <div
                        onClick={() => setExpandedIncomeId(isExpanded ? null : `${inc.type || 'inc'}-${inc.id}`)}
                        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FEE4D7]/15 transition-colors select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Avatar Initials Bubble */}
                          <div className={`w-9 h-9 rounded-full ${isSale ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-500/30' : 'bg-[#FEE4D7]/70 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] border-[#D4B28E]/40 dark:border-[#9F6839]/30'} font-black text-xs flex items-center justify-center border shrink-0`}>
                            {initials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-[#432414] dark:text-[#FEE4D7] truncate">
                              {inc.description || (isSale ? `Venta #${inc.order_number || inc.sale_id}` : 'Ingreso manual')}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {isSale ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  POS {inc.customer_name ? `· ${inc.customer_name}` : ''}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#9F6839] dark:text-[#DABA8C]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#9F6839]" />
                                  Extra
                                </span>
                              )}
                              <span className="text-[10px] text-[#9F6839]/60 dark:text-[#DABA8C]/50 tabular-nums">
                                · {new Date(inc.created_at).toLocaleDateString('es-CO')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Amount & Chevron */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                            +${Number(inc.amount).toLocaleString('es-CO')}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-[#9F6839] dark:text-[#DABA8C] transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expandable Accordion Drawer ("Hidden isn't deleted") */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-[#FEE4D7]/10 dark:bg-[#201009]/50 border-t border-[#D4B28E]/20 dark:border-[#9F6839]/20 space-y-3 animate-in fade-in duration-150">
                          {/* Metadata Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded-xl bg-white/70 dark:bg-[#150904]/70 border border-[#D4B28E]/30 dark:border-[#9F6839]/20">
                              <span className="text-[10px] uppercase font-semibold text-[#9F6839] dark:text-[#DABA8C] block">
                                Método de Pago
                              </span>
                              <span className="font-medium text-[#432414] dark:text-[#FEE4D7] capitalize block mt-0.5">
                                {inc.payment_method || 'efectivo'}
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-white/70 dark:bg-[#150904]/70 border border-[#D4B28E]/30 dark:border-[#9F6839]/20">
                              <span className="text-[10px] uppercase font-semibold text-[#9F6839] dark:text-[#DABA8C] block">
                                Cliente / Origen
                              </span>
                              <span className="font-medium text-[#432414] dark:text-[#FEE4D7] block mt-0.5 truncate">
                                {inc.customer_name || (isSale ? 'Cliente POS' : 'Extraordinario')}
                              </span>
                            </div>
                          </div>

                          <div className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/60 tabular-nums">
                            Fecha y hora exacta: {new Date(inc.created_at).toLocaleString('es-CO')}
                          </div>

                          {/* Action Buttons */}
                          {isManual && isOwner && (
                            <div className="flex items-center gap-2 pt-2 border-t border-[#D4B28E]/20 dark:border-[#9F6839]/20">
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  handleOpenEditIncome(inc)
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FEE4D7]/80 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] text-xs font-bold transition-all cursor-pointer shadow-xs"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Editar Ingreso</span>
                              </button>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  handleDeleteIncome(inc)
                                }}
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* DESKTOP VIEW FOR INGRESOS (Image 2: Linear Table) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FEE4D7]/30 dark:bg-[#201009] border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30 text-[#9F6839] dark:text-[#DABA8C] uppercase font-semibold text-[11px] tracking-wider">
                    <tr>
                      <th className="px-2.5 py-2 whitespace-nowrap">Fecha & Hora</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Tipo / Origen</th>
                      <th className="px-2.5 py-2">Descripción / Concepto</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Método de Pago</th>
                      <th className="px-2.5 py-2 text-right whitespace-nowrap">Monto Cobrado</th>
                      <th className="px-2.5 py-2 text-right whitespace-nowrap w-20 min-w-[70px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4B28E]/20 dark:divide-[#9F6839]/20">
                    {filteredIncomes.map((inc) => {
                      const isSale = inc.type === 'sale'
                      const isManual = !isSale

                      return (
                        <tr
                          key={`${inc.type || 'inc'}-${inc.id}`}
                          className="hover:bg-[#FEE4D7]/20 dark:hover:bg-[#2A160D]/70 transition-colors duration-100 group"
                        >
                          {/* Fecha y Hora */}
                          <td className="px-2.5 py-1.5 whitespace-nowrap font-medium text-[#432414] dark:text-[#FEE4D7] text-xs">
                            <span className="tabular-nums">
                              {new Date(inc.created_at).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/60 font-normal tabular-nums ml-1">
                              {new Date(inc.created_at).toLocaleTimeString('es-CO', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </td>

                          {/* Tipo / Origen Badge */}
                          <td className="px-2.5 py-1.5 whitespace-nowrap">
                            {isSale ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Venta POS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#9F6839]/10 text-[#9F6839] dark:text-[#DABA8C] border border-[#9F6839]/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#9F6839]" />
                                Ingreso Extra
                              </span>
                            )}
                          </td>

                          {/* Concepto */}
                          <td className="px-2.5 py-1.5">
                            <div className="font-semibold text-[#432414] dark:text-[#FEE4D7] text-xs">
                              {inc.description || (isSale ? `Orden #${inc.order_number || inc.sale_id}` : 'Ingreso manual')}
                            </div>
                            {isSale && inc.customer_name && (
                              <span className="text-[10px] text-[#9F6839]/80 dark:text-[#DABA8C]/70 font-normal block">
                                Cliente: {inc.customer_name}
                              </span>
                            )}
                          </td>

                          {/* Método de Pago */}
                          <td className="px-2.5 py-1.5 whitespace-nowrap">
                            <span className="text-xs font-normal capitalize text-[#432414] dark:text-[#FEE4D7]">
                              {inc.payment_method || 'efectivo'}
                            </span>
                          </td>

                          {/* Monto Cobrado */}
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400 text-xs tabular-nums">
                            +${Number(inc.amount).toLocaleString('es-CO')}
                          </td>

                          {/* Acciones */}
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap w-20 min-w-[70px]">
                            {isManual && isOwner ? (
                              <div className="flex items-center justify-end gap-1">
                                <button type="button"
                                  onClick={() => handleOpenEditIncome(inc)}
                                  className="p-1 text-[#9F6839] hover:text-[#432414] dark:hover:text-[#FEE4D7] hover:bg-[#FEE4D7]/60 dark:hover:bg-[#34180D] rounded-md transition-colors cursor-pointer"
                                  title="Editar Ingreso"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button type="button"
                                  onClick={() => handleDeleteIncome(inc)}
                                  className="p-1 text-[#9F6839] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                                  title="Eliminar Ingreso"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#9F6839]/30">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL CREAR / EDITAR GASTO */}
      {isExpenseModalOpen && (
        <Modal
          isOpen={isExpenseModalOpen}
          onClose={() => !expenseSubmitting && setIsExpenseModalOpen(false)}
          title={editingExpense ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
        >
          <form onSubmit={handleSaveExpense} className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            {expenseError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{expenseError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Descripción del Gasto *
              </label>
              <input
                type="text"
                required
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="Ej. Compra de 5 bolsas de café en grano"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Monto ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="Ej. 120000"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839] font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Categoría
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Método de Pago
                </label>
                <select
                  value={expenseForm.payment_method}
                  onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Fecha y Hora
                </label>
                <input
                  type="datetime-local"
                  value={expenseForm.created_at}
                  onChange={(e) => setExpenseForm({ ...expenseForm, created_at: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7]"
                />
              </div>
            </div>

            {!editingExpense && (
              <div className="p-3 bg-[#FEE4D7]/40 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-[#9F6839] dark:text-[#DABA8C]">
                  Reabastecer Insumo de Inventario (Opcional)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={expenseForm.ingredient_id}
                    onChange={(e) => setExpenseForm({ ...expenseForm, ingredient_id: e.target.value })}
                    aria-label="Seleccionar insumo asociado"
                    className="col-span-1 px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus-visible:ring-2 focus-visible:ring-[#9F6839]"
                  >
                    <option value="">Ninguno</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>{ing.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="any"
                    placeholder="Cantidad"
                    aria-label="Cantidad a sumar al inventario"
                    value={expenseForm.quantity_added}
                    onChange={(e) => setExpenseForm({ ...expenseForm, quantity_added: e.target.value })}
                    className="col-span-1 px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus-visible:ring-2 focus-visible:ring-[#9F6839]"
                  />

                  <select
                    value={expenseForm.unit}
                    onChange={(e) => setExpenseForm({ ...expenseForm, unit: e.target.value })}
                    aria-label="Unidad de medida del insumo"
                    className="col-span-1 px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus-visible:ring-2 focus-visible:ring-[#9F6839]"
                  >
                    {AVAILABLE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="px-4 py-2.5 text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={expenseSubmitting}
                className="px-5 py-2.5 bg-[#9F6839] hover:bg-[#835229] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {expenseSubmitting ? 'Guardando...' : editingExpense ? 'Guardar Cambios' : 'Registrar Gasto'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL CREAR / EDITAR INGRESO */}
      {isIncomeModalOpen && (
        <Modal
          isOpen={isIncomeModalOpen}
          onClose={() => !incomeSubmitting && setIsIncomeModalOpen(false)}
          title={editingIncome ? 'Editar Ingreso' : 'Registrar Ingreso Extraordinario'}
        >
          <form onSubmit={handleSaveIncome} className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            {incomeError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{incomeError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Descripción del Ingreso *
              </label>
              <input
                type="text"
                required
                value={incomeForm.description}
                onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                placeholder="Ej. Servicio de café para evento universitario"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Monto ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  placeholder="Ej. 250000"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839] font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Categoría
                </label>
                <select
                  value={incomeForm.category}
                  onChange={(e) => setIncomeForm({ ...incomeForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                >
                  {INCOME_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Método de Pago
                </label>
                <select
                  value={incomeForm.payment_method}
                  onChange={(e) => setIncomeForm({ ...incomeForm, payment_method: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                  Fecha y Hora
                </label>
                <input
                  type="datetime-local"
                  value={incomeForm.created_at}
                  onChange={(e) => setIncomeForm({ ...incomeForm, created_at: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
              <button
                type="button"
                onClick={() => setIsIncomeModalOpen(false)}
                className="px-4 py-2.5 text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={incomeSubmitting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {incomeSubmitting ? 'Guardando...' : editingIncome ? 'Guardar Cambios' : 'Registrar Ingreso'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
