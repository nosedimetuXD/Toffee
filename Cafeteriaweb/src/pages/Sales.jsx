import { useEffect, useState, useMemo, useRef } from 'react'
import { api } from '../api/client'
import Modal from '../components/Modal'
import confetti from 'canvas-confetti'
import { processImageUrl } from '../utils/imageUtils'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Coffee,
  ShoppingBag,
  Banknote,
  Smartphone,
  CreditCard,
  AlertCircle,
  AlertTriangle,
  Tag,
  Printer,
  Download,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  X,
  Phone,
  UserCheck,
  UserPlus,
  QrCode,
  BadgeDollarSign
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { downloadReceiptPDF, printReceiptPDF, shareReceiptPDFToWhatsApp } from '../utils/pdfReceipt'

const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80'
const COMMON_BANKS = ['Bre-B/Llave', 'Nequi', 'Daviplata', 'Bancolombia', 'Nu', 'Davivienda', 'BBVA', 'Banco de Bogotá']
const DISCOUNT_PRESETS = [5, 10, 15, 20, 50]
const DISCOUNT_REASONS = ['Promoción del día', 'Cliente Frecuente', 'Cortesía de la casa', 'Amigo / Familiar', 'Convenio']

export default function Sales() {
  const { user } = useAuth()
  const isOwner = (user?.role || '').toLowerCase() === 'owner' || (user?.role || '').toLowerCase() === 'dueño'

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Clientes CRM y Autocompletado estilo Google
  const [crmCustomers, setCrmCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const customerDropdownRef = useRef(null)

  // Creacion rapida de cliente desde el POS
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false)
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    notes: ''
  })
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)
  const [quickCustomerError, setQuickCustomerError] = useState('')

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q) return crmCustomers.slice(0, 8)
    return crmCustomers.filter((c) => {
      const fullName = `${c.first_name} ${c.last_name || ''}`.toLowerCase()
      const phone = (c.phone || '').toLowerCase()
      return fullName.includes(q) || phone.includes(q)
    }).slice(0, 10)
  }, [customerQuery, crmCustomers])

  // Almacenamiento local de imágenes
  const [productImages, setProductImages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('toffe_product_images') || '{}')
    } catch (e) {
      return {}
    }
  })

  // Carrito de compras
  const [cartItems, setCartItems] = useState([])
  const [tableNumber, setTableNumber] = useState('')
  const [tipAmount, setTipAmount] = useState(0)

  // Estado del drawer de carrito en móvil
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  // Descuentos (Solo Dueños)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [showDiscountInputs, setShowDiscountInputs] = useState(false)

  // Modal de cobro y cliente
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [saleType, setSaleType] = useState('total') // 'total' | 'parcial' | 'credito'
  const [partialPaidAmount, setPartialPaidAmount] = useState('')
  const [isQRPopupOpen, setIsQRPopupOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [cashAmount, setCashAmount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')

  // Desglose de Bancos
  const [bankPayments, setBankPayments] = useState([{ bank: 'Bre-B/Llave', amount: '' }])

  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  // Modal Recibo
  const [lastOrder, setLastOrder] = useState(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)

  const isProductActive = (p) => (typeof p.active !== 'undefined' ? p.active : p.is_active ?? true)

  async function loadData() {
    try {
      setLoading(true)
      const [prodData, customersData] = await Promise.all([
        api.get('/products'),
        api.get('/customers').catch(() => [])
      ])
      setProducts(prodData || [])
      setCrmCustomers(Array.isArray(customersData) ? customersData : [])

      const cats = Array.from(new Set((prodData || []).map((p) => p.category))).filter(Boolean)
      setCategories(['Todos', ...cats])
    } catch (err) {
      setError('No se pudieron cargar los productos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Cerrar menú desplegable de clientes al hacer clic por fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Función para resaltar coincidencias de texto
  function highlightMatches(text, query) {
    if (!text) return ''
    if (!query || !query.trim()) return text
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <strong key={i} className="font-black text-[#9F6839] dark:text-[#DABA8C]">
          {part}
        </strong>
      ) : (
        part
      )
    )
  }

  function addToCart(product, qtyToAdd = 1) {
    if (!isProductActive(product)) return
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + qtyToAdd } : item
        )
      }
      return [...prev, { product, quantity: qtyToAdd }]
    })
  }

  function updateQuantity(productId, delta) {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta
            return newQty > 0 ? { ...item, quantity: newQty } : null
          }
          return item
        })
        .filter(Boolean)
    )
  }

  function removeFromCart(productId) {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId))
  }

  function clearCart() {
    setCartItems([])
    setTableNumber('')
    setTipAmount(0)
    setDiscountPercent(0)
    setDiscountAmount(0)
    setDiscountReason('')
    setSelectedCustomerId(null)
    setSelectedCustomerObj(null)
    setIsMobileCartOpen(false)
  }

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0)
  }, [cartItems])

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + it.quantity, 0)
  }, [cartItems])

  const calculatedDiscountAmount = useMemo(() => {
    if (!isOwner) return 0
    if (discountPercent > 0) {
      return cartSubtotal * (discountPercent / 100)
    }
    return Math.min(cartSubtotal, discountAmount)
  }, [isOwner, discountPercent, discountAmount, cartSubtotal])

  const cartTotal = useMemo(() => {
    const afterDiscount = Math.max(0, cartSubtotal - calculatedDiscountAmount)
    return Math.max(0, afterDiscount + tipAmount)
  }, [cartSubtotal, calculatedDiscountAmount, tipAmount])

  const effectivePaidAmount = useMemo(() => {
    if (saleType === 'credito') return 0
    if (saleType === 'parcial') {
      const val = Number(partialPaidAmount) || 0
      return Math.min(cartTotal, Math.max(0, val))
    }
    return cartTotal
  }, [saleType, partialPaidAmount, cartTotal])

  const effectivePendingAmount = useMemo(() => {
    return Math.max(0, cartTotal - effectivePaidAmount)
  }, [cartTotal, effectivePaidAmount])

  function handleApplyPercent(pct) {
    if (discountPercent === pct) {
      setDiscountPercent(0)
      setDiscountAmount(0)
    } else {
      setDiscountPercent(pct)
      setDiscountAmount(0)
    }
  }

  function handleCustomAmountChange(val) {
    setDiscountPercent(0)
    setDiscountAmount(Number(val) || 0)
  }

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!isProductActive(p)) return false
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [products, selectedCategory, searchQuery])

  function handleSelectCustomer(c) {
    if (!c) {
      setSelectedCustomerId(null)
      setSelectedCustomerObj(null)
      setCustomerName('')
      setCustomerQuery('')
      setIsCustomerDropdownOpen(false)
      return
    }
    setSelectedCustomerId(c.id)
    setSelectedCustomerObj(c)
    const fullName = `${c.first_name} ${c.last_name || ''}`.trim()
    setCustomerName(fullName)
    setCustomerQuery(fullName)
    setIsCustomerDropdownOpen(false)
  }

  function handleClearCustomer() {
    setSelectedCustomerId(null)
    setSelectedCustomerObj(null)
    setCustomerName('')
    setCustomerQuery('')
    setIsCustomerDropdownOpen(false)
  }

  function handleUseCustomCustomerName(name) {
    setSelectedCustomerId(null)
    setSelectedCustomerObj(null)
    setCustomerName(name.trim())
    setCustomerQuery(name.trim())
    setIsCustomerDropdownOpen(false)
  }

  function handleOpenQuickCustomerModal(query = customerQuery) {
    const raw = (query || '').trim()
    const parts = raw.split(/\s+/)
    let first_name = ''
    let last_name = ''
    if (parts.length === 1) {
      first_name = parts[0]
    } else if (parts.length > 1) {
      first_name = parts[0]
      last_name = parts.slice(1).join(' ')
    }
    setQuickCustomerForm({
      first_name,
      last_name,
      phone: '',
      notes: ''
    })
    setQuickCustomerError('')
    setIsQuickCustomerModalOpen(true)
    setIsCustomerDropdownOpen(false)
  }

  async function handleQuickCreateCustomer(e) {
    e.preventDefault()
    const firstName = quickCustomerForm.first_name.trim()
    if (!firstName) {
      setQuickCustomerError('El nombre del cliente es obligatorio.')
      return
    }

    try {
      setIsCreatingCustomer(true)
      setQuickCustomerError('')
      const payload = {
        first_name: firstName,
        last_name: quickCustomerForm.last_name.trim(),
        phone: quickCustomerForm.phone.trim(),
        notes: quickCustomerForm.notes.trim()
      }

      const created = await api.post('/customers', payload)
      const newCustomerObj = {
        ...created,
        total_debt: 0,
        total_paid_eligible: 0
      }

      setCrmCustomers((prev) => [newCustomerObj, ...prev])
      const fullName = `${newCustomerObj.first_name} ${newCustomerObj.last_name || ''}`.trim()
      setSelectedCustomerId(newCustomerObj.id)
      setSelectedCustomerObj(newCustomerObj)
      setCustomerName(fullName)
      setCustomerQuery(fullName)
      setIsQuickCustomerModalOpen(false)
      setIsCustomerDropdownOpen(false)
    } catch (err) {
      console.error('Error creando cliente rapido:', err)
      setQuickCustomerError(err.message || 'Error al registrar el cliente.')
    } finally {
      setIsCreatingCustomer(false)
    }
  }

  function openCheckout() {
    if (cartItems.length === 0) return
    setIsMobileCartOpen(false)
    setSelectedCustomerId(null)
    setSelectedCustomerObj(null)
    setCustomerName('')
    setCustomerQuery('')
    setIsCustomerDropdownOpen(false)
    setIsQuickCustomerModalOpen(false)
    setQuickCustomerError('')
    setIsCreatingCustomer(false)
    setQuickCustomerForm({ first_name: '', last_name: '', phone: '', notes: '' })
    setSaleType('total')
    setPartialPaidAmount('')
    setPaymentMethod('efectivo')
    setCashAmount(String(cartTotal))
    setTransferAmount('0')
    setBankPayments([{ bank: 'Bre-B/Llave', amount: String(cartTotal) }])
    setCheckoutError('')

    // Refrescar clientes de fondo
    api.get('/customers').then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setCrmCustomers(data)
      }
    }).catch(() => {})

    setIsCheckoutOpen(true)
  }

  function handleSelectSaleType(type) {
    setSaleType(type)
    setCheckoutError('')
    if (type === 'total') {
      setPartialPaidAmount('')
      if (paymentMethod === 'efectivo') {
        setCashAmount(String(cartTotal))
        setTransferAmount('0')
      } else if (paymentMethod === 'transferencia') {
        setCashAmount('0')
        setTransferAmount(String(cartTotal))
        setBankPayments([{ bank: 'Bre-B/Llave', amount: String(cartTotal) }])
      }
    } else if (type === 'parcial') {
      const initial = Math.round(cartTotal / 2)
      setPartialPaidAmount(String(initial))
      if (paymentMethod === 'efectivo') {
        setCashAmount(String(initial))
        setTransferAmount('0')
      } else if (paymentMethod === 'transferencia') {
        setCashAmount('0')
        setTransferAmount(String(initial))
        setBankPayments([{ bank: 'Bre-B/Llave', amount: String(initial) }])
      }
    } else if (type === 'credito') {
      setPartialPaidAmount('0')
      setCashAmount('0')
      setTransferAmount('0')
    }
  }

  function handlePartialAmountChange(val) {
    setPartialPaidAmount(val)
    const num = Number(val) || 0
    if (paymentMethod === 'efectivo') {
      setCashAmount(String(num))
    } else if (paymentMethod === 'transferencia') {
      setTransferAmount(String(num))
      setBankPayments([{ bank: 'Bre-B/Llave', amount: String(num) }])
    }
  }

  function handleSelectPaymentMethod(method) {
    setPaymentMethod(method)
    setCheckoutError('')
    const targetAmount = saleType === 'parcial' ? (Number(partialPaidAmount) || 0) : cartTotal
    if (method === 'efectivo') {
      setCashAmount(String(targetAmount))
      setTransferAmount('0')
    } else if (method === 'transferencia') {
      setCashAmount('0')
      setTransferAmount(String(targetAmount))
      setBankPayments([{ bank: 'Bre-B/Llave', amount: String(targetAmount) }])
    } else if (method === 'mixto') {
      const half = Math.round(targetAmount / 2)
      setCashAmount(String(half))
      setTransferAmount(String(targetAmount - half))
      setBankPayments([{ bank: 'Bre-B/Llave', amount: String(targetAmount - half) }])
    }
  }

  function addBankLine() {
    setBankPayments((prev) => [...prev, { bank: 'Bre-B/Llave', amount: '' }])
  }

  function removeBankLine(index) {
    if (bankPayments.length <= 1) return
    setBankPayments((prev) => prev.filter((_, i) => i !== index))
  }

  function updateBankLine(index, field, value) {
    setBankPayments((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      if (field === 'amount') {
        const sumTransfers = next.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        setTransferAmount(String(sumTransfers))
      }
      return next
    })
  }

  async function handleConfirmSale(e) {
    e.preventDefault()
    setSubmitting(true)
    setCheckoutError('')

    if (effectivePendingAmount > 0 && !selectedCustomerId) {
      setCheckoutError('Debes seleccionar un cliente registrado para ventas a crédito o con saldo pendiente.')
      setSubmitting(false)
      return
    }

    const finalCustomer = customerName.trim() || 'Cliente General'
    let numCash = Number(cashAmount) || 0
    let numTransfer = Number(transferAmount) || 0
    let bankDetailsStr = ''

    if (saleType === 'credito') {
      numCash = 0
      numTransfer = 0
      bankDetailsStr = ''
    } else if (paymentMethod === 'efectivo') {
      if (numCash < effectivePaidAmount) {
        setCheckoutError(`El efectivo entregado ($${numCash.toLocaleString()}) es menor al monto a pagar hoy ($${effectivePaidAmount.toLocaleString()})`)
        setSubmitting(false)
        return
      }
      numTransfer = 0
    } else if (paymentMethod === 'transferencia') {
      numCash = 0
      for (const b of bankPayments) {
        const bankNameClean = b.bank.trim().toLowerCase()
        const bankAmountNum = Number(b.amount) || 0
        if (!bankNameClean || bankAmountNum <= 0) {
          setCheckoutError('Ingresa un monto válido para cada banco.')
          setSubmitting(false)
          return
        }
      }

      numTransfer = bankPayments.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
      if (numTransfer !== effectivePaidAmount) {
        setCheckoutError(`La suma de transferencias ($${numTransfer.toLocaleString()}) debe ser igual al monto a pagar hoy ($${effectivePaidAmount.toLocaleString()}).`)
        setSubmitting(false)
        return
      }
      bankDetailsStr = bankPayments.map((b) => `${b.bank.trim()}: $${Number(b.amount).toLocaleString()}`).join(' | ')
    } else if (paymentMethod === 'mixto') {
      if (numCash <= 0) {
        setCheckoutError('En Pago Mixto el abono en efectivo debe ser mayor a $0.')
        setSubmitting(false)
        return
      }
      numTransfer = bankPayments.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
      if (numCash + numTransfer < effectivePaidAmount) {
        setCheckoutError(`El pago total ($${(numCash + numTransfer).toLocaleString()}) es inferior al monto a cobrar ($${effectivePaidAmount.toLocaleString()}).`)
        setSubmitting(false)
        return
      }
      bankDetailsStr = bankPayments.map((b) => `${b.bank.trim()}: $${Number(b.amount).toLocaleString()}`).join(' | ')
    }

    try {
      const payload = {
        customer_id: selectedCustomerId || null,
        customer_name: finalCustomer,
        payment_method: saleType === 'credito' ? 'credito' : paymentMethod,
        paid_amount: effectivePaidAmount,
        cash_amount: saleType === 'credito' ? 0 : numCash,
        transfer_amount: saleType === 'credito' ? 0 : numTransfer,
        bank_details: bankDetailsStr,
        discount_percent: discountPercent,
        discount_amount: calculatedDiscountAmount,
        discount_reason: discountReason.trim(),
        items: cartItems.map((it) => ({
          product_id: it.product.id,
          quantity: it.quantity,
          notes: ''
        }))
      }

      const response = await api.post('/sales', payload)

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      })

      const completedOrder = {
        id: response?.id || Date.now(),
        order_number: response?.order_number || '',
        customer_name: finalCustomer,
        payment_method: saleType === 'credito' ? 'credito' : paymentMethod,
        paid_amount: response?.paid_amount ?? effectivePaidAmount,
        pending_amount: response?.pending_amount ?? effectivePendingAmount,
        payment_status: response?.payment_status || (effectivePendingAmount > 0 ? (effectivePaidAmount > 0 ? 'partial' : 'pending') : 'paid'),
        bank_details: bankDetailsStr,
        subtotal: cartSubtotal,
        discount_percent: discountPercent,
        discount_amount: calculatedDiscountAmount,
        discount_reason: discountReason,
        total: cartTotal,
        sold_by_username: user?.username || 'Barista',
        created_at: new Date().toISOString(),
        items: cartItems.map((it) => ({
          product_id: it.product.id,
          product_name: it.product.name,
          quantity: it.quantity,
          unit_price: it.product.price
        }))
      }

      setLastOrder(completedOrder)
      setIsCheckoutOpen(false)
      setIsReceiptOpen(true)
      clearCart()
      loadData()
    } catch (err) {
      console.error('Error registrando venta:', err)
      setCheckoutError(err.message || 'Ocurrió un error al procesar la venta.')
    } finally {
      setSubmitting(false)
    }
  }

  const changeDue = useMemo(() => {
    if (saleType === 'credito' || paymentMethod !== 'efectivo') return 0
    const val = Number(cashAmount) || 0
    return Math.max(0, val - effectivePaidAmount)
  }, [saleType, paymentMethod, cashAmount, effectivePaidAmount])

  return (
    <div className="relative flex flex-col lg:flex-row h-[calc(100vh-5.5rem)] gap-4 select-none text-[#432414] dark:text-[#FEE4D7] pb-16 lg:pb-0">
      {/* SECCIÓN IZQUIERDA: Catálogo de Productos */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-2xl p-4 shadow-sm overflow-hidden h-full">
        {/* Cabecera y Buscador */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-[#432414] dark:text-[#FEE4D7]">
                Punto de Venta
              </h2>
              <p className="text-[11px] text-[#9F6839] dark:text-[#DABA8C]">Toffee Espresso & Bakery</p>
            </div>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9F6839] dark:text-[#DABA8C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar café, postre o bebida..."
              className="w-full pl-10 pr-3.5 py-1.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] placeholder-[#9F6839]/60 dark:placeholder-[#DABA8C]/50 focus:outline-none focus:border-[#9F6839]"
            />
          </div>
        </div>

        {/* Categorías */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
          {categories.map((cat) => (
            <button type="button"
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#9F6839] text-white font-bold'
                  : 'bg-[#FEE4D7]/40 dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border border-[#D4B28E]/40 dark:border-[#9F6839]/30 hover:bg-[#FEE4D7]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid de Productos */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#9F6839] dark:text-[#DABA8C] gap-2">
              <div className="w-5 h-5 border-2 border-[#9F6839] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold">Cargando menú...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#9F6839] dark:text-[#DABA8C] text-center">
              <Coffee className="w-8 h-8 text-[#9F6839]/40 mb-2" />
              <p className="text-xs font-semibold">No hay productos en esta vista</p>
              <p className="text-[11px] opacity-70">Verifica la categoría o búsqueda ingresada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredProducts.map((p) => {
                const imgUrl = productImages[p.id] || p.image_url || DEFAULT_PRODUCT_IMAGE
                const cartMatch = cartItems.find((ci) => ci.product.id === p.id)

                return (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="group bg-white dark:bg-[#25120B] hover:bg-[#FEE4D7]/30 dark:hover:bg-[#2A150C] border border-[#D4B28E]/40 dark:border-[#9F6839]/30 hover:border-[#9F6839] rounded-xl p-2 transition-all cursor-pointer flex flex-col justify-between relative shadow-xs"
                  >
                    {cartMatch && (
                      <div className="absolute top-2 right-2 bg-[#9F6839] text-white font-bold text-[11px] px-1.5 py-0.2 rounded-full shadow-xs z-10">
                        {cartMatch.quantity}
                      </div>
                    )}

                    <div className="aspect-square w-full rounded-lg overflow-hidden mb-1.5 bg-[#FEE4D7]/30 dark:bg-[#1A0C06] relative">
                      <img
                        src={processImageUrl(imgUrl)}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          e.target.src = DEFAULT_PRODUCT_IMAGE
                        }}
                      />
                    </div>

                    <div>
                      <h4 className="font-semibold text-xs text-[#432414] dark:text-[#FEE4D7] line-clamp-1 group-hover:text-[#9F6839] dark:group-hover:text-[#DABA8C]">
                        {p.name}
                      </h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-[#432414] dark:text-[#FEE4D7] tabular-nums">
                          ${Number(p.price).toLocaleString('es-CO')}
                        </span>
                        <div className="w-5 h-5 rounded-md bg-[#FEE4D7] dark:bg-[#3E2114] text-[#9F6839] dark:text-[#DABA8C] flex items-center justify-center group-hover:bg-[#9F6839] group-hover:text-white transition-colors">
                          <Plus className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* BACKDROP MÓVIL CUANDO EL CARRITO ESTÁ EXPANDIDO */}
      {isMobileCartOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity duration-300 ease-out animate-in fade-in"
          onClick={() => setIsMobileCartOpen(false)}
        />
      )}

      {/* BARRA FLOTANTE FIJA INFERIOR EN MÓVIL (CUANDO EL DRAWER ESTÁ MINIMIZADO) */}
      <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30 bg-[#201009] dark:bg-[#201009] border border-[#9F6839]/60 text-white rounded-2xl p-3 shadow-xl flex items-center justify-between transition-all duration-200 active:scale-[0.99]">
        <button type="button"
          onClick={() => setIsMobileCartOpen(true)}
          className="flex items-center gap-3 flex-1 text-left cursor-pointer focus:outline-none"
        >
          <div className="relative p-2 bg-[#9F6839] rounded-xl text-white shadow-xs">
            <ShoppingBag className="w-4 h-4" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#FEE4D7] text-[#432414] text-[10px] font-bold px-1 py-0.2 rounded-full border border-[#9F6839]">
                {totalCartCount}
              </span>
            )}
          </div>
          <div>
            <span className="text-xs font-semibold text-[#DABA8C] flex items-center gap-1">
              <span>{cartItems.length > 0 ? `Orden (${cartItems.length} tipos)` : 'Ver Orden'}</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </span>
            <span className="text-sm font-bold text-[#FEE4D7] block leading-tight tabular-nums">
              ${Number(cartTotal).toLocaleString('es-CO')}
            </span>
          </div>
        </button>

        {cartItems.length > 0 && (
          <button type="button"
            onClick={openCheckout}
            className="px-3.5 py-2 bg-[#9F6839] hover:bg-[#835229] active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4" />
            <span>Cobrar</span>
          </button>
        )}
      </div>

      {/* CONTENEDOR DEL CARRITO (SIDEBAR EN DESKTOP / DRAWER DESPLEGABLE EN MÓVIL) */}
      <div
        className={`fixed lg:static bottom-0 left-0 right-0 z-50 lg:z-auto w-full lg:w-96 flex flex-col bg-white dark:bg-[#1E0F08] border-t lg:border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-t-2xl lg:rounded-2xl p-4 shadow-xl lg:shadow-sm max-h-[85vh] lg:max-h-full drawer-motion ${
          isMobileCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'
        }`}
      >
        {/* Handle visual de arrastre en móvil */}
        <div className="lg:hidden w-12 h-1.5 rounded-full bg-[#9F6839]/40 dark:bg-[#DABA8C]/30 mx-auto mb-2.5 cursor-grab" onClick={() => setIsMobileCartOpen(false)} />

        {/* Encabezado Carrito */}
        <div className="flex items-center justify-between pb-3 border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30 mb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
            <h3 className="font-black text-sm text-[#432414] dark:text-[#FEE4D7]">Orden Actual</h3>
            <span className="text-xs font-bold text-[#9F6839] dark:text-[#DABA8C]">({cartItems.length})</span>
          </div>

          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-800/40 transition-all duration-150 cursor-pointer shadow-2xs active:scale-95"
                title="Vaciar orden actual"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
                <span>Vaciar</span>
              </button>
            )}

            {/* Botón Minimizar en Móvil */}
            <button type="button"
              onClick={() => setIsMobileCartOpen(false)}
              className="lg:hidden p-1.5 text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] dark:hover:bg-[#2A150C] rounded-xl transition-colors cursor-pointer"
              title="Minimizar orden"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>


        {/* Lista de Ítems del Carrito */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 max-h-48 lg:max-h-none">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#9F6839] dark:text-[#DABA8C] text-center">
              <ShoppingBag className="w-8 h-8 text-[#9F6839]/40 mb-2" />
              <p className="text-xs font-bold">Tu orden está vacía</p>
              <p className="text-[11px] opacity-70">Selecciona productos del menú.</p>
            </div>
          ) : (
            cartItems.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="p-2.5 bg-[#FEE4D7]/30 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/30 rounded-2xl flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-extrabold text-[#432414] dark:text-[#FEE4D7] truncate">
                    {product.name}
                  </h4>
                  <span className="text-[11px] text-[#9F6839] dark:text-[#DABA8C] font-bold">
                    ${Number(product.price).toLocaleString('es-CO')} c/u
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button type="button"
                    onClick={() => updateQuantity(product.id, -1)}
                    className="w-6 h-6 rounded-lg bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/30 hover:bg-[#FEE4D7] flex items-center justify-center text-[#432414] dark:text-[#FEE4D7] transition-colors cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-black text-[#432414] dark:text-[#FEE4D7]">
                    {quantity}
                  </span>
                  <button type="button"
                    onClick={() => updateQuantity(product.id, 1)}
                    className="w-6 h-6 rounded-lg bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/30 hover:bg-[#FEE4D7] flex items-center justify-center text-[#432414] dark:text-[#FEE4D7] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button type="button"
                    onClick={() => removeFromCart(product.id)}
                    className="p-1 text-[#9F6839] dark:text-[#DABA8C] hover:text-red-600 transition-colors cursor-pointer ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sección de Descuentos (Solo Dueños) */}
        {isOwner && cartItems.length > 0 && (
          <div className="p-3 bg-[#FEE4D7]/40 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#432414] dark:text-[#FEE4D7]">
                <Tag className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
                <span>Descuento en Caja</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscountInputs(!showDiscountInputs)}
                className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] hover:underline cursor-pointer"
              >
                {showDiscountInputs ? 'Ocultar' : 'Aplicar'}
              </button>
            </div>

            {showDiscountInputs && (
              <div className="space-y-2 pt-1 animate-fade-in">
                <div className="grid grid-cols-5 gap-1">
                  {DISCOUNT_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleApplyPercent(pct)}
                      className={`py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        discountPercent === pct
                          ? 'bg-[#9F6839] text-white shadow-xs'
                          : 'bg-white dark:bg-[#201009] text-[#432414] dark:text-[#FEE4D7] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={discountAmount || ''}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    placeholder="Monto $"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-lg text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                  />
                  <select
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-lg text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                  >
                    <option value="">Motivo...</option>
                    {DISCOUNT_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resumen de Totales y Botón Cobrar */}
        <div className="pt-3 border-t border-[#D4B28E]/40 dark:border-[#9F6839]/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9F6839] dark:text-[#DABA8C]">
            <span>Subtotal:</span>
            <span className="font-bold">${Number(cartSubtotal).toLocaleString('es-CO')}</span>
          </div>

          {calculatedDiscountAmount > 0 && (
            <div className="flex items-center justify-between text-xs text-red-600 dark:text-red-400 font-bold">
              <span>Descuento {discountPercent > 0 ? `(${discountPercent}%)` : ''}:</span>
              <span>-${Number(calculatedDiscountAmount).toLocaleString('es-CO')}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-base font-black text-[#432414] dark:text-[#FEE4D7] pt-1">
            <span>TOTAL:</span>
            <span className="text-xl text-[#9F6839] dark:text-[#DABA8C]">
              ${Number(cartTotal).toLocaleString('es-CO')}
            </span>
          </div>

          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={openCheckout}
            className="w-full py-3.5 bg-[#9F6839] hover:bg-[#835229] text-white font-black rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Cobrar ${Number(cartTotal).toLocaleString('es-CO')}</span>
          </button>
        </div>
      </div>

      {/* MODAL DE CHECKOUT / PAGO */}
      {isCheckoutOpen && (
        <Modal
          isOpen={isCheckoutOpen}
          onClose={() => !submitting && setIsCheckoutOpen(false)}
          title="Completar Cobro & Generar Comanda"
        >
          <form onSubmit={handleConfirmSale} className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            {checkoutError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Tipo de Venta / Modalidad */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider">
                Modalidad de Cobro
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectSaleType('total')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    saleType === 'total'
                      ? 'bg-[#9F6839] text-white border-[#9F6839] shadow-xs'
                      : 'bg-white dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pago Completo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSaleType('parcial')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    saleType === 'parcial'
                      ? 'bg-[#9F6839] text-white border-[#9F6839] shadow-xs'
                      : 'bg-white dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]'
                  }`}
                >
                  <BadgeDollarSign className="w-4 h-4" />
                  <span>Pago Parcial</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSaleType('credito')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    saleType === 'credito'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>A Crédito / Fiado</span>
                </button>
              </div>
            </div>

            {saleType === 'parcial' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 dark:text-amber-200">Monto abonado hoy ($):</span>
                  <input
                    type="number"
                    min="0"
                    max={cartTotal}
                    value={partialPaidAmount}
                    onChange={(e) => handlePartialAmountChange(e.target.value)}
                    className="w-32 px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-amber-300 dark:border-amber-800 rounded-xl text-right font-black text-amber-900 dark:text-amber-100 focus:outline-none"
                  />
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold">
                  <span>Saldo que queda debiendo:</span>
                  <span className="font-black text-sm text-red-600 dark:text-red-400">
                    ${Number(effectivePendingAmount).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            )}

            {saleType === 'credito' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Venta 100% a Crédito (Fiado)</p>
                  <p className="text-[11px] opacity-90">
                    No se cobra dinero en este momento. El total de ${Number(cartTotal).toLocaleString('es-CO')} se sumará al saldo deudor del cliente seleccionado.
                  </p>
                </div>
              </div>
            )}

            {/* Selección de Cliente con Autocompletado estilo Google / Gmail */}
            <div ref={customerDropdownRef} className="relative space-y-1">
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>
                  Cliente {effectivePendingAmount > 0 ? <span className="text-red-500 font-black">(Requerido para crédito/deuda)</span> : '(Opcional)'}
                </span>
                {selectedCustomerObj && Number(selectedCustomerObj.total_debt) > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800">
                    Debe ${Number(selectedCustomerObj.total_debt).toLocaleString('es-CO')}
                  </span>
                )}
              </label>

              {/* Input de búsqueda interactivo */}
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-[#9F6839] dark:text-[#DABA8C] pointer-events-none">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={customerQuery}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value)
                    setCustomerName(e.target.value)
                    if (selectedCustomerId) {
                      setSelectedCustomerId(null)
                      setSelectedCustomerObj(null)
                    }
                    setIsCustomerDropdownOpen(true)
                  }}
                  placeholder="Escribe el nombre o iniciales del cliente..."
                  className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839] focus:ring-2 focus:ring-[#9F6839]/20 transition-all placeholder:text-[#9F6839]/50 dark:placeholder:text-[#DABA8C]/50"
                />
                {(customerQuery || selectedCustomerId) && (
                  <button
                    type="button"
                    onClick={handleClearCustomer}
                    className="absolute right-3 p-1 rounded-full text-[#9F6839] dark:text-[#DABA8C] hover:text-red-600 hover:bg-[#FEE4D7]/50 dark:hover:bg-[#201009] transition-colors cursor-pointer"
                    title="Limpiar cliente"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Menú Desplegable Flotante de Resultados */}
              {isCustomerDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#201009] rounded-2xl border border-[#D4B28E]/80 dark:border-[#9F6839]/60 shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                  {filteredCustomers.length > 0 ? (
                    <div className="py-1 divide-y divide-[#FEE4D7]/60 dark:divide-[#2A150C]">
                      {filteredCustomers.map((c) => {
                        const fullName = `${c.first_name} ${c.last_name || ''}`.trim()
                        const initials = `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase()
                        const hasDebt = Number(c.total_debt) > 0
                        const isSelected = selectedCustomerId === c.id

                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className={`flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#9F6839]/15 dark:bg-[#9F6839]/30'
                                : 'hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A150C]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                              {/* Avatar con Iniciales */}
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9F6839] to-[#D4B28E] text-white font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs">
                                {initials || <UserCheck className="w-4 h-4" />}
                              </div>

                              {/* Nombre y teléfono */}
                              <div className="min-w-0">
                                <p className="font-extrabold text-[#432414] dark:text-[#FEE4D7] truncate">
                                  {highlightMatches(fullName, customerQuery)}
                                </p>
                                {c.phone && (
                                  <p className="text-[10px] text-[#9F6839] dark:text-[#DABA8C] flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-[#9F6839] dark:text-[#DABA8C] shrink-0" />
                                    <span>{highlightMatches(c.phone, customerQuery)}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Estado / Badge de Deuda y Consumo */}
                            <div className="shrink-0 flex items-center gap-1.5">
                              {hasDebt ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800">
                                  Debe ${Number(c.total_debt).toLocaleString('es-CO')}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Al día
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-[#9F6839] dark:text-[#DABA8C]">
                      No se encontraron clientes registrados con esas iniciales.
                    </div>
                  )}

                  {/* Opción de Crear Nuevo Cliente en Base de Datos */}
                  {customerQuery.trim() && !crmCustomers.some(c => `${c.first_name} ${c.last_name || ''}`.trim().toLowerCase() === customerQuery.trim().toLowerCase()) && (
                    <div className="border-t border-[#D4B28E]/60 dark:border-[#9F6839]/40 divide-y divide-[#FEE4D7]/60 dark:divide-[#2A150C]">
                      <div
                        onClick={() => handleOpenQuickCustomerModal(customerQuery)}
                        className="p-3 bg-gradient-to-r from-[#FEE4D7]/50 to-[#FEE4D7]/20 dark:from-[#2A150C] dark:to-[#201009] hover:from-[#FEE4D7] hover:to-[#FEE4D7]/60 dark:hover:from-[#351a0e] dark:hover:to-[#2A150C] flex items-center justify-between gap-2 text-xs font-black text-[#7B4E26] dark:text-[#DABA8C] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-[#9F6839] text-white flex items-center justify-center shrink-0 shadow-xs">
                            <UserPlus className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <span>Crear nuevo cliente <strong>&quot;{customerQuery.trim()}&quot;</strong></span>
                            {effectivePendingAmount > 0 && (
                              <span className="block text-[10px] text-red-600 dark:text-red-400 font-bold">
                                Permite asignarle la deuda (${effectivePendingAmount.toLocaleString('es-CO')})
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[#9F6839] text-white font-extrabold uppercase shadow-xs">
                          + Registrar
                        </span>
                      </div>

                      {/* Si no hay saldo pendiente, permitir usar como cliente ocasional sin registrar */}
                      {effectivePendingAmount === 0 && (
                        <div
                          onClick={() => handleUseCustomCustomerName(customerQuery)}
                          className="p-2.5 bg-[#FEE4D7]/20 dark:bg-[#201009] hover:bg-[#FEE4D7]/50 dark:hover:bg-[#2A150C] flex items-center gap-2 text-[11px] font-bold text-[#7B4E26]/80 dark:text-[#DABA8C]/80 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#9F6839]" />
                          <span>Usar como cliente ocasional para esta venta (sin guardar en CRM)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Ficha rápida del cliente seleccionado */}
              {selectedCustomerObj && (
                <div className="mt-2 p-2.5 rounded-xl bg-[#FEE4D7]/30 dark:bg-[#2A150C]/60 border border-[#D4B28E]/50 dark:border-[#9F6839]/30 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
                      <span className="font-bold text-[#432414] dark:text-[#FEE4D7]">
                        {selectedCustomerObj.first_name} {selectedCustomerObj.last_name || ''}
                      </span>
                      {selectedCustomerObj.phone && (
                        <span className="text-[10px] text-[#9F6839] dark:text-[#DABA8C]">
                          ({selectedCustomerObj.phone})
                        </span>
                      )}
                    </div>
                    {Number(selectedCustomerObj.total_spent) > 0 && (
                      <span className="text-[10px] font-bold text-[#9F6839] dark:text-[#DABA8C]">
                        ${Number(selectedCustomerObj.total_spent).toLocaleString('es-CO')} consumido
                      </span>
                    )}
                  </div>
                  {Number(selectedCustomerObj.total_debt) > 0 && (
                    <div className="p-2 rounded-lg bg-red-100/70 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-xs text-red-700 dark:text-red-300 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>Atención: Cliente con deuda acumulada de ${Number(selectedCustomerObj.total_debt).toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  {selectedCustomerObj.notes && (
                    <div className="text-[10px] text-[#9F6839] dark:text-[#DABA8C] flex items-center gap-1 pl-6">
                      <Sparkles className="w-3 h-3 text-[#9F6839] dark:text-[#DABA8C] shrink-0" />
                      <span><strong>Preferencia:</strong> {selectedCustomerObj.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN MÉTODO DE PAGO */}
            {saleType !== 'credito' ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider">
                      Método de Pago
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQRPopupOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#FEE4D7] dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 hover:bg-[#9F6839] hover:text-white transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Ver QR Bold</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectPaymentMethod('efectivo')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        paymentMethod === 'efectivo'
                          ? 'bg-[#9F6839] text-white border-[#9F6839] shadow-xs'
                          : 'bg-white dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Efectivo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectPaymentMethod('transferencia')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        paymentMethod === 'transferencia'
                          ? 'bg-[#9F6839] text-white border-[#9F6839] shadow-xs'
                          : 'bg-white dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Transferencia</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectPaymentMethod('mixto')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        paymentMethod === 'mixto'
                          ? 'bg-[#9F6839] text-white border-[#9F6839] shadow-xs'
                          : 'bg-white dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border-[#D4B28E]/70 dark:border-[#9F6839]/40 hover:bg-[#FEE4D7]'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pago Mixto</span>
                    </button>
                  </div>
                </div>

                {paymentMethod === 'efectivo' && (
                  <div className="p-3 bg-[#FEE4D7]/30 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl space-y-2">
                    <div>
                      <label className="block text-xs font-bold text-[#9F6839] dark:text-[#DABA8C] mb-1">
                        Efectivo Recibido ($)
                      </label>
                      <input
                        type="number"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        placeholder={String(effectivePaidAmount)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-sm font-bold text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setCashAmount(String(effectivePaidAmount))}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#D4B28E] dark:border-[#9F6839]/60 bg-white dark:bg-[#201009] text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] dark:hover:bg-[#34180D] transition-colors shadow-xs cursor-pointer"
                      >
                        Monto Exacto
                      </button>
                      {[10000, 20000, 50000, 100000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashAmount(String(val))}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#D4B28E]/70 dark:border-[#9F6839]/50 bg-white dark:bg-[#201009] text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7] dark:hover:bg-[#34180D] transition-colors shadow-xs cursor-pointer"
                        >
                          ${val.toLocaleString('es-CO')}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold pt-1">
                      <span className="text-[#9F6839] dark:text-[#DABA8C]">Cambio / Vueltos:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-sm font-black">
                        ${Number(changeDue).toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                )}

                {(paymentMethod === 'transferencia' || paymentMethod === 'mixto') && (
                  <div className="p-3 bg-[#FEE4D7]/30 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl space-y-2.5">
                    {paymentMethod === 'mixto' && (
                      <div className="mb-2">
                        <label className="block text-xs font-bold text-[#9F6839] dark:text-[#DABA8C] mb-1">
                          Abono en Efectivo ($)
                        </label>
                        <input
                          type="number"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-sm font-bold text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-[#9F6839] dark:text-[#DABA8C]">
                        Bancos / Entidades
                      </label>
                      <button
                        type="button"
                        onClick={addBankLine}
                        className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] hover:underline cursor-pointer"
                      >
                        + Agregar Banco
                      </button>
                    </div>

                    <div className="space-y-2">
                      {bankPayments.map((bp, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={bp.bank}
                            onChange={(e) => updateBankLine(idx, 'bank', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                          >
                            {COMMON_BANKS.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            placeholder="Monto"
                            value={bp.amount}
                            onChange={(e) => updateBankLine(idx, 'amount', e.target.value)}
                            className="w-28 px-2.5 py-1.5 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs font-bold text-[#432414] dark:text-[#FEE4D7] focus:outline-none"
                          />
                          {bankPayments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBankLine(idx)}
                              className="p-1 text-[#9F6839] hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-700 dark:text-amber-300 font-bold">
                Venta asignada a Crédito. El valor total de ${Number(cartTotal).toLocaleString('es-CO')} quedará cargado a la cuenta del cliente.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsCheckoutOpen(false)}
                className="px-4 py-2.5 text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#9F6839] hover:bg-[#835229] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Confirmar Venta</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL COMPROBANTE DE VENTA EXITOSA */}
      {isReceiptOpen && lastOrder && (
        <Modal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          title={`Ticket de Venta — Orden #${lastOrder.order_number || 'Generada'}`}
        >
          <div className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-xs text-emerald-900 dark:text-emerald-200">
                  ¡Venta Registrada Exitosamente!
                </h4>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Comanda enviada a cocina.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#FEE4D7]/40 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl text-xs space-y-2 text-[#432414] dark:text-[#FEE4D7]">
              <div className="flex justify-between">
                <span className="text-[#9F6839] dark:text-[#DABA8C] font-bold">Cliente:</span>
                <span className="font-extrabold">{lastOrder.customer_name || 'Cliente General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9F6839] dark:text-[#DABA8C] font-bold">Método de Pago:</span>
                <span className="font-bold uppercase">{lastOrder.payment_method}</span>
              </div>
              {lastOrder.bank_details && (
                <div className="flex justify-between">
                  <span className="text-[#9F6839] dark:text-[#DABA8C] font-bold">Bancos:</span>
                  <span className="font-bold">{lastOrder.bank_details}</span>
                </div>
              )}

              {/* Detalle de Productos / Descripcion de la compra */}
              <div className="pt-2 pb-1 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
                <div className="text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] mb-2 uppercase tracking-wider">
                  Productos comprados:
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 divide-y divide-[#D4B28E]/30 dark:divide-[#9F6839]/20">
                  {lastOrder.items && lastOrder.items.length > 0 ? (
                    lastOrder.items.map((it, idx) => (
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
                  ) : null}
                </div>
              </div>

              {(Number(lastOrder.discount_amount) > 0 || Number(lastOrder.discount_percent) > 0) && (
                <div className="flex justify-between text-xs text-red-600 dark:text-red-400 font-bold pt-1">
                  <span>
                    Descuento {Number(lastOrder.discount_percent) > 0 ? `(${lastOrder.discount_percent}%)` : ''}:
                  </span>
                  <span>-${Number(lastOrder.discount_amount || 0).toLocaleString('es-CO')}</span>
                </div>
              )}

              <div className="pt-2 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30 flex justify-between text-sm font-black text-[#432414] dark:text-[#FEE4D7]">
                <span>Total:</span>
                <span className="text-[#9F6839] dark:text-[#DABA8C]">${Number(lastOrder.total).toLocaleString('es-CO')}</span>
              </div>

              {Number(lastOrder.pending_amount) > 0 && (
                <div className="pt-2 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30 space-y-1">
                  <div className="flex justify-between font-bold text-xs text-[#432414] dark:text-[#FEE4D7]">
                    <span>Abonado hoy:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">
                      ${Number(lastOrder.paid_amount || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-xs text-red-600 dark:text-red-400">
                    <span>Saldo pendiente (Deuda):</span>
                    <span className="font-black">
                      ${Number(lastOrder.pending_amount).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => printReceiptPDF(lastOrder)}
                className="p-3 bg-white dark:bg-[#2A150C] hover:bg-[#FEE4D7] dark:hover:bg-[#3E2114] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl text-xs font-bold text-[#432414] dark:text-[#FEE4D7] flex flex-col items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
                <span>Imprimir Ticket</span>
              </button>

              <button
                type="button"
                onClick={() => downloadReceiptPDF(lastOrder)}
                className="p-3 bg-white dark:bg-[#2A150C] hover:bg-[#FEE4D7] dark:hover:bg-[#3E2114] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-2xl text-xs font-bold text-[#432414] dark:text-[#FEE4D7] flex flex-col items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
                <span>Descargar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => shareReceiptPDFToWhatsApp(lastOrder, selectedCustomerObj?.phone || '')}
                className="p-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex flex-col items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Enviar WhatsApp</span>
              </button>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-[#D4B28E]/60 dark:border-[#9F6839]/30">
              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                className="w-full py-2.5 bg-[#9F6839] hover:bg-[#835229] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL VISOR RÁPIDO DE QR BOLD */}
      {isQRPopupOpen && (
        <Modal
          isOpen={isQRPopupOpen}
          onClose={() => setIsQRPopupOpen(false)}
          title="Código QR Bold - @boldcaov5716"
        >
          <div className="flex flex-col items-center gap-4 text-center p-2 text-[#432414] dark:text-[#FEE4D7]">
            <div className="p-3 bg-white rounded-2xl border-2 border-[#D4B28E]/70 shadow-md">
              <img
                src="/qr-bold.jpg"
                alt="QR Bold Toffee"
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl"
              />
            </div>
            <div>
              <p className="text-sm font-black">Llave Bold / Bre-B</p>
              <p className="text-xs font-bold text-[#9F6839] dark:text-[#DABA8C]">@boldcaov5716</p>
              <p className="text-[11px] opacity-75 mt-1">
                Muestra este código al cliente para pagos desde Bancolombia, Nequi, Daviplata o cualquier billetera digital.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsQRPopupOpen(false)}
              className="w-full py-2.5 bg-[#9F6839] hover:bg-[#835229] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de Creacion Rapida de Cliente */}
      {isQuickCustomerModalOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-in fade-in duration-150"
          onClick={() => !isCreatingCustomer && setIsQuickCustomerModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/60 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30 bg-[#FEE4D7]/30 dark:bg-[#2A150C]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#9F6839]/15 text-[#9F6839] dark:text-[#DABA8C] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#432414] dark:text-[#FEE4D7]">
                    Registrar Nuevo Cliente
                  </h3>
                  <p className="text-[10px] text-[#9F6839] dark:text-[#DABA8C] font-semibold">
                    Crear y vincular a esta venta para registrar deuda
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isCreatingCustomer}
                onClick={() => setIsQuickCustomerModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] dark:hover:bg-[#34180D] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateCustomer} className="p-6 space-y-3.5">
              {quickCustomerError && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span>{quickCustomerError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-[#432414] dark:text-[#FEE4D7] mb-1">
                    Nombre <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={quickCustomerForm.first_name}
                    onChange={(e) => setQuickCustomerForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Ej. Carlos"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FEE4D7]/20 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:ring-2 focus:ring-[#9F6839]/20 focus:border-[#9F6839]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-[#432414] dark:text-[#FEE4D7] mb-1">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={quickCustomerForm.last_name}
                    onChange={(e) => setQuickCustomerForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Ej. Mendoza"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FEE4D7]/20 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:ring-2 focus:ring-[#9F6839]/20 focus:border-[#9F6839]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#432414] dark:text-[#FEE4D7] mb-1">
                  Telefono / WhatsApp <span className="text-[10px] lowercase text-[#9F6839]/70 dark:text-[#DABA8C]/70">(opcional)</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-[#9F6839] pointer-events-none">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="tel"
                    value={quickCustomerForm.phone}
                    onChange={(e) => setQuickCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ej. 300 123 4567"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#FEE4D7]/20 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:ring-2 focus:ring-[#9F6839]/20 focus:border-[#9F6839]"
                  />
                </div>
                <p className="text-[10px] text-[#9F6839] dark:text-[#DABA8C] mt-1 font-semibold">
                  Recomendado para comprobantes por WhatsApp y recordatorios de saldo.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#432414] dark:text-[#FEE4D7] mb-1">
                  Notas / Referencia <span className="text-[10px] lowercase text-[#9F6839]/70 dark:text-[#DABA8C]/70">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={quickCustomerForm.notes}
                  onChange={(e) => setQuickCustomerForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ej. Estudiante, salon 101, oficina..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FEE4D7]/20 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 text-xs font-bold text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:ring-2 focus:ring-[#9F6839]/20 focus:border-[#9F6839]"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isCreatingCustomer}
                  onClick={() => setIsQuickCustomerModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-[#D4B28E]/80 dark:border-[#9F6839]/40 text-xs font-bold text-[#432414]/70 dark:text-[#FEE4D7]/70 hover:bg-[#FEE4D7]/30 dark:hover:bg-[#2A150C] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCustomer || !quickCustomerForm.first_name.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#9F6839] to-[#7B4E26] hover:from-[#8B5A30] hover:to-[#6A421F] text-white text-xs font-black shadow-md shadow-[#9F6839]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isCreatingCustomer ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Crear y Asignar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
