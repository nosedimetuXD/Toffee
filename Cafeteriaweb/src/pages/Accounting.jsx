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
  FileSpreadsheet
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

  const filteredIncomes = useMemo(() => {
    if (incomeFilter === 'all') return incomes
    return incomes.filter((inc) => (inc.type || 'manual') === incomeFilter)
  }, [incomes, incomeFilter])

  return (
    <div className="space-y-6 text-[#432414] dark:text-[#FEE4D7]">
      {/* Header Principal */}
      <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-2xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#432414] dark:text-[#FEE4D7]">
                Contabilidad & Flujo de Caja
              </h1>
              <p className="text-xs font-semibold text-[#9F6839] dark:text-[#DABA8C] mt-0.5">
                Control de ingresos, gastos clasificados, balance neto y exportación contable.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Grupo Exportacion */}
          <div className="inline-flex items-center p-1 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl shadow-xs">
            <button
              onClick={() => exportAccountingToExcel(expenses, incomes)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              title="Descargar en formato Excel (.xls)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
            <div className="h-3.5 w-px bg-[#D4B28E]/60 dark:bg-[#9F6839]/40 mx-0.5" />
            <button
              onClick={() => exportAccountingToCSV(expenses, incomes)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] rounded-xl transition-all cursor-pointer whitespace-nowrap"
              title="Descargar en formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
              <span>CSV</span>
            </button>
          </div>

          {/* Grupo Acciones Principales */}
          <div className="inline-flex items-center gap-2">
            <button
              onClick={handleOpenCreateIncome}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Ingreso</span>
            </button>

            <button
              onClick={handleOpenCreateExpense}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#9F6839] hover:bg-[#835229] text-white rounded-2xl text-xs font-black shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Gasto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tarjetas Resumen Financiero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Ingresos Totales */}
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Ingresos Totales</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${Number(totalIngresosCalc).toLocaleString('es-CO')}
            </div>
            <span className="text-[10px] text-[#9F6839] dark:text-[#DABA8C] font-semibold block mt-0.5">
              Ventas: ${Number(salesIncomeTotal).toLocaleString('es-CO')} | Extra: ${Number(manualIncomeTotal).toLocaleString('es-CO')}
            </span>
          </div>
        </div>

        {/* Gastos Totales */}
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-2xl border border-red-200/60 dark:border-red-900/40">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Gastos Totales</span>
            <div className="text-2xl font-black text-red-600 dark:text-red-400">
              ${Number(totalGastosCalc).toLocaleString('es-CO')}
            </div>
            <span className="text-[10px] text-[#9F6839] dark:text-[#DABA8C] font-semibold block mt-0.5">
              {expenses.length} movimientos registrados
            </span>
          </div>
        </div>

        {/* Balance Neto */}
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-2xl border ${balanceNetoCalc >= 0 ? 'bg-[#FEE4D7] dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] border-[#D4B28E]/50 dark:border-[#9F6839]/30' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200'}`}>
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider block">Ganancia Neta</span>
            <div className={`text-2xl font-black ${balanceNetoCalc >= 0 ? 'text-[#432414] dark:text-[#FEE4D7]' : 'text-red-600 dark:text-red-400'}`}>
              ${Number(balanceNetoCalc).toLocaleString('es-CO')}
            </div>
            <span className="text-[10px] text-[#9F6839] dark:text-[#DABA8C] font-semibold block mt-0.5">
              Balance neto acumulado
            </span>
          </div>
        </div>
      </div>

      {/* Tabs y Periodos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4B28E]/60 dark:border-[#9F6839]/30 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-[#9F6839] text-white shadow-xs'
                : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A150C]'
            }`}
          >
            Gastos ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab('incomes')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'incomes'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A150C]'
            }`}
          >
            Ingresos ({incomes.length})
          </button>
        </div>

        {/* Selector de Periodo */}
        <div className="flex items-center gap-1 bg-[#FEE4D7]/40 dark:bg-[#2A150C] p-1 rounded-2xl border border-[#D4B28E]/60 dark:border-[#9F6839]/30 self-start sm:self-auto overflow-x-auto">
          {[
            { id: 'today', label: 'Hoy' },
            { id: 'week', label: '7 Días' },
            { id: 'month', label: 'Este Mes' },
            { id: 'year', label: 'Este Año' },
            { id: 'all', label: 'Todo' }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                period === p.id
                  ? 'bg-[#9F6839] text-white shadow-xs font-black'
                  : 'text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] dark:hover:bg-[#3E2114]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB GASTOS */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl overflow-hidden shadow-sm">
          {expenses.length === 0 ? (
            <div className="p-12 text-center text-[#9F6839] dark:text-[#DABA8C]">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-xs">No hay gastos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FEE4D7]/50 dark:bg-[#2A150C] border-b border-[#D4B28E]/60 dark:border-[#9F6839]/30 text-[#9F6839] dark:text-[#DABA8C] uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Fecha</th>
                    <th className="px-4 py-3.5">Descripción & Categoría</th>
                    <th className="px-4 py-3.5">Método de Pago</th>
                    <th className="px-4 py-3.5">Insumo Reabastecido</th>
                    <th className="px-4 py-3.5">Monto</th>
                    <th className="px-4 py-3.5">Registrado Por</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4B28E]/40 dark:divide-[#9F6839]/20">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-[#FEE4D7]/30 dark:hover:bg-[#2A150C]/60 transition-colors">
                      <td className="px-5 py-4 font-bold text-[#432414] dark:text-[#FEE4D7]">
                        {new Date(e.created_at).toLocaleDateString('es-CO')}
                        <span className="block text-[10px] text-[#9F6839] dark:text-[#DABA8C] font-normal">
                          {new Date(e.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-extrabold text-[#432414] dark:text-[#FEE4D7]">{e.description}</div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-[#FEE4D7] dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] text-[10px] font-bold uppercase border border-[#D4B28E]/60 dark:border-[#9F6839]/30">
                          {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 capitalize text-[#432414] dark:text-[#FEE4D7] font-medium">
                        {e.payment_method}
                      </td>
                      <td className="px-4 py-4">
                        {e.ingredient_name ? (
                          <div className="text-[#432414] dark:text-[#FEE4D7] font-bold">
                            {e.ingredient_name}
                            <span className="text-emerald-600 dark:text-emerald-400 text-[11px] block">+{e.quantity_added} agregados</span>
                          </div>
                        ) : (
                          <span className="text-[#9F6839] dark:text-[#DABA8C]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-black text-red-600 dark:text-red-400 text-sm">
                        -${Number(e.amount).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-4 text-[#9F6839] dark:text-[#DABA8C] font-medium">
                        {e.registerer_name || 'Personal'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {isOwner && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditExpense(e)}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors cursor-pointer"
                              title="Editar Gasto"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(e)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                              title="Eliminar Gasto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB INGRESOS */}
      {activeTab === 'incomes' && (
        <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl overflow-hidden shadow-sm">
          {/* Sub-filtros de Tipo de Ingreso */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#FEE4D7]/30 dark:bg-[#2A150C] border-b border-[#D4B28E]/60 dark:border-[#9F6839]/30">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'all', label: `Todos (${incomes.length})` },
                { id: 'sale', label: `Ventas POS (${salesIncomesCount})` },
                { id: 'manual', label: `Ingresos Extras (${manualIncomesCount})` }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setIncomeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    incomeFilter === f.id
                      ? 'bg-emerald-600 text-white shadow-xs font-black'
                      : 'bg-white dark:bg-[#201009] text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7]/60 dark:hover:bg-[#3E2114] border border-[#D4B28E]/50 dark:border-[#9F6839]/30'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleOpenCreateIncome}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-xs ml-auto whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Ingreso Extra</span>
            </button>
          </div>

          {filteredIncomes.length === 0 ? (
            <div className="p-12 text-center text-[#9F6839] dark:text-[#DABA8C]">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50 text-emerald-500" />
              <p className="font-bold text-xs">No hay ingresos registrados para este filtro o periodo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FEE4D7]/50 dark:bg-[#2A150C] border-b border-[#D4B28E]/60 dark:border-[#9F6839]/30 text-[#9F6839] dark:text-[#DABA8C] uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 whitespace-nowrap">Fecha & Hora</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Tipo / Origen</th>
                    <th className="px-4 py-3.5">Descripción / Concepto</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Método de Pago</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">Monto Cobrado</th>
                    <th className="px-5 py-3.5 text-center whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4B28E]/40 dark:divide-[#9F6839]/20">
                  {filteredIncomes.map((inc) => {
                    const isSale = inc.type === 'sale'
                    const isManual = !isSale

                    return (
                      <tr
                        key={`${inc.type || 'inc'}-${inc.id}`}
                        className="hover:bg-[#FEE4D7]/30 dark:hover:bg-[#2A150C]/60 transition-colors"
                      >
                        {/* Fecha y Hora */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-[#432414] dark:text-[#FEE4D7]">
                              {new Date(inc.created_at).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="text-[10px] text-[#9F6839] dark:text-[#DABA8C]">
                              {new Date(inc.created_at).toLocaleTimeString('es-CO', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Tipo / Origen Badge */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {isSale ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] uppercase border border-emerald-300/60 dark:border-emerald-800/40">
                              <ShoppingBag className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Venta POS</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FEE4D7] dark:bg-[#3E2114] text-[#9F6839] dark:text-[#DABA8C] font-extrabold text-[10px] uppercase border border-[#D4B28E]/70 dark:border-[#9F6839]/50">
                              <Plus className="w-3 h-3 text-[#9F6839] dark:text-[#DABA8C]" />
                              <span>Ingreso Extra</span>
                            </span>
                          )}
                        </td>

                        {/* Descripción / Concepto */}
                        <td className="px-4 py-4">
                          <div className="font-extrabold text-[#432414] dark:text-[#FEE4D7]">
                            {isSale ? (inc.customer_name || (inc.description || '').replace(/^Venta POS - /i, '') || 'Cliente General') : inc.description}
                          </div>
                          {inc.category && inc.category !== 'Venta POS' && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-[#FEE4D7]/60 dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] text-[10px] font-bold uppercase border border-[#D4B28E]/50 dark:border-[#9F6839]/30">
                              {inc.category}
                            </span>
                          )}
                        </td>

                        {/* Método de Pago */}
                        <td className="px-4 py-4 capitalize text-[#432414] dark:text-[#FEE4D7] font-medium whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="uppercase font-bold">{inc.payment_method}</span>
                            {inc.bank_details && (
                              <span className="text-[10px] text-[#9F6839] dark:text-[#DABA8C]">
                                ({inc.bank_details})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Monto */}
                        <td className="px-4 py-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                          +${Number(inc.amount).toLocaleString('es-CO')}
                        </td>

                        {/* Acciones */}
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          {isManual ? (
                            isOwner && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEditIncome(inc)}
                                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors cursor-pointer"
                                  title="Editar Ingreso"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteIncome(inc)}
                                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                                  title="Eliminar Ingreso"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase border border-emerald-200/60 dark:border-emerald-800/40">
                              POS
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
                    className="col-span-1 px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7]"
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
                    value={expenseForm.quantity_added}
                    onChange={(e) => setExpenseForm({ ...expenseForm, quantity_added: e.target.value })}
                    className="col-span-1 px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7]"
                  />

                  <select
                    value={expenseForm.unit}
                    onChange={(e) => setExpenseForm({ ...expenseForm, unit: e.target.value })}
                    className="col-span-1 px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7]"
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
