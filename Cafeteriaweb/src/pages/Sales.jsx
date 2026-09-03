import { useEffect, useState, useMemo } from 'react'
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
  Tag,
  Printer,
  Download,
  MessageCircle,
  Sparkles,
  CheckCircle2
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

  // Clientes CRM
  const [crmCustomers, setCrmCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null)

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

  // Descuentos (Solo Dueños)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [showDiscountInputs, setShowDiscountInputs] = useState(false)

  // Modal de cobro y cliente
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
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
  }

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0)
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

  function handleSelectCrmCustomer(c) {
    if (!c) {
      setSelectedCustomerId(null)
      setSelectedCustomerObj(null)
      setCustomerName('')
      return
    }
    setSelectedCustomerId(c.id)
    setSelectedCustomerObj(c)
    const fullName = `${c.first_name} ${c.last_name || ''}`.trim()
    setCustomerName(fullName)
  }

  function openCheckout() {
    if (cartItems.length === 0) return
    setPaymentMethod('efectivo')
    setCashAmount(String(cartTotal))
    setTransferAmount('0')
    setBankPayments([{ bank: 'Bre-B/Llave', amount: String(cartTotal) }])
    setCheckoutError('')
    setIsCheckoutOpen(true)
  }

  function handleSelectPaymentMethod(method) {
    setPaymentMethod(method)
    setCheckoutError('')
    if (method === 'efectivo') {
      setCashAmount(String(cartTotal))
      setTransferAmount('0')
    } else if (method === 'transferencia') {
      setCashAmount('0')
      setTransferAmount(String(cartTotal))
      setBankPayments([{ bank: 'Bre-B/Llave', amount: String(cartTotal) }])
    } else if (method === 'mixto') {
      const half = Math.round(cartTotal / 2)
      setCashAmount(String(half))
      setTransferAmount(String(cartTotal - half))
      setBankPayments([{ bank: 'Bre-B/Llave', amount: String(cartTotal - half) }])
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

    const finalCustomer = customerName.trim() || 'Cliente General'
    let numCash = Number(cashAmount) || 0
    let numTransfer = Number(transferAmount) || 0
    let bankDetailsStr = ''

    if (paymentMethod === 'efectivo') {
      if (numCash < cartTotal) {
        setCheckoutError(`El efectivo entregado ($${numCash.toLocaleString()}) es menor al total ($${cartTotal.toLocaleString()})`)
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
      if (numTransfer !== cartTotal) {
        setCheckoutError(`La suma de transferencias ($${numTransfer.toLocaleString()}) debe ser igual al total ($${cartTotal.toLocaleString()}).`)
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
      if (numCash + numTransfer < cartTotal) {
        setCheckoutError(`El pago total ($${(numCash + numTransfer).toLocaleString()}) es inferior al monto a cobrar ($${cartTotal.toLocaleString()}).`)
        setSubmitting(false)
        return
      }
      bankDetailsStr = bankPayments.map((b) => `${b.bank.trim()}: $${Number(b.amount).toLocaleString()}`).join(' | ')
    }

    try {
      const payload = {
        customer_id: selectedCustomerId || null,
        customer_name: finalCustomer,
        payment_method: paymentMethod,
        cash_amount: numCash,
        transfer_amount: numTransfer,
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
        payment_method: paymentMethod,
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
    if (paymentMethod !== 'efectivo') return 0
    const val = Number(cashAmount) || 0
    return Math.max(0, val - cartTotal)
  }, [paymentMethod, cashAmount, cartTotal])

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-5.5rem)] gap-4 select-none text-[#432414] dark:text-[#FEE4D7]">
      {/* SECCIÓN IZQUIERDA: Catálogo de Productos */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-4 shadow-sm overflow-hidden">
        {/* Cabecera y Buscador */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-2xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-[#432414] dark:text-[#FEE4D7]">
                Punto de Venta
              </h2>
              <p className="text-xs text-[#9F6839] dark:text-[#DABA8C] font-semibold">Toffee Espresso & Bakery</p>
            </div>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9F6839] dark:text-[#DABA8C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar café, postre o bebida..."
              className="w-full pl-10 pr-3.5 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] placeholder-[#9F6839]/60 dark:placeholder-[#DABA8C]/50 focus:outline-none focus:border-[#9F6839]"
            />
          </div>
        </div>

        {/* Categorías */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#9F6839] text-white shadow-xs'
                  : 'bg-[#FEE4D7]/50 dark:bg-[#2A150C] text-[#432414] dark:text-[#FEE4D7] border border-[#D4B28E]/60 dark:border-[#9F6839]/30 hover:bg-[#FEE4D7]'
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
              <div className="w-6 h-6 border-2 border-[#9F6839] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold">Cargando menú...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#9F6839] dark:text-[#DABA8C] text-center">
              <Coffee className="w-10 h-10 text-[#9F6839]/40 mb-2" />
              <p className="text-xs font-bold">No hay productos en esta vista</p>
              <p className="text-[11px] opacity-70">Verifica la categoría o búsqueda ingresada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const imgUrl = productImages[p.id] || p.image_url || DEFAULT_PRODUCT_IMAGE
                const cartMatch = cartItems.find((ci) => ci.product.id === p.id)

                return (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="group bg-white dark:bg-[#25120B] hover:bg-[#FEE4D7]/40 dark:hover:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 hover:border-[#9F6839] rounded-2xl p-2.5 transition-all cursor-pointer flex flex-col justify-between relative shadow-xs"
                  >
                    {cartMatch && (
                      <div className="absolute top-2 right-2 bg-[#9F6839] text-white font-black text-xs px-2 py-0.5 rounded-full shadow-md z-10">
                        {cartMatch.quantity}
                      </div>
                    )}

                    <div className="aspect-square w-full rounded-xl overflow-hidden mb-2 bg-[#FEE4D7]/50 dark:bg-[#1A0C06] relative">
                      <img
                        src={processImageUrl(imgUrl)}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.src = DEFAULT_PRODUCT_IMAGE
                        }}
                      />
                    </div>

                    <div>
                      <h4 className="font-extrabold text-xs text-[#432414] dark:text-[#FEE4D7] line-clamp-1 group-hover:text-[#9F6839] dark:group-hover:text-[#DABA8C]">
                        {p.name}
                      </h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-black text-[#9F6839] dark:text-[#DABA8C]">
                          ${Number(p.price).toLocaleString('es-CO')}
                        </span>
                        <div className="w-5 h-5 rounded-lg bg-[#FEE4D7] dark:bg-[#3E2114] text-[#9F6839] dark:text-[#DABA8C] flex items-center justify-center group-hover:bg-[#9F6839] group-hover:text-white transition-colors">
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

      {/* SECCIÓN DERECHA: Carrito & Cobro */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-4 shadow-sm">
        {/* Encabezado Carrito */}
        <div className="flex items-center justify-between pb-3 border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30 mb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
            <h3 className="font-black text-sm text-[#432414] dark:text-[#FEE4D7]">Orden Actual</h3>
            <span className="text-xs font-bold text-[#9F6839] dark:text-[#DABA8C]">({cartItems.length})</span>
          </div>

          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-600 dark:text-red-400 hover:underline font-bold transition-colors cursor-pointer"
            >
              Vaciar
            </button>
          )}
        </div>

        {/* Selector de Cliente Habitual (CRM) */}
        <div className="mb-3">
          <label className="block text-[11px] font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
            Cliente Habitual
          </label>
          <select
            value={selectedCustomerId || ''}
            onChange={(e) => {
              const val = e.target.value
              if (!val) {
                handleSelectCrmCustomer(null)
              } else {
                const found = crmCustomers.find((c) => c.id === val)
                handleSelectCrmCustomer(found)
              }
            }}
            className="w-full px-3 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
          >
            <option value="">Cliente Ocasional / General</option>
            {crmCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name || ''} {c.phone ? `(${c.phone})` : ''}
              </option>
            ))}
          </select>

          {/* Badge de preferencias del cliente seleccionado */}
          {selectedCustomerObj?.notes && (
            <div className="mt-2 p-2.5 bg-[#FEE4D7]/40 dark:bg-[#2A150C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-xl text-[11px] text-[#432414] dark:text-[#FEE4D7] flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C] flex-shrink-0 mt-0.5" />
              <div>
                <strong>Gusto del cliente:</strong> {selectedCustomerObj.notes}
              </div>
            </div>
          )}
        </div>

        {/* Lista de Ítems del Carrito */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#9F6839] dark:text-[#DABA8C] text-center">
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
                  <button
                    onClick={() => updateQuantity(product.id, -1)}
                    className="w-6 h-6 rounded-lg bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/30 hover:bg-[#FEE4D7] flex items-center justify-center text-[#432414] dark:text-[#FEE4D7] transition-colors cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-black text-[#432414] dark:text-[#FEE4D7]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(product.id, 1)}
                    className="w-6 h-6 rounded-lg bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/30 hover:bg-[#FEE4D7] flex items-center justify-center text-[#432414] dark:text-[#FEE4D7] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
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

            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Nombre del Cliente
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value)
                  setSelectedCustomerId(null)
                }}
                placeholder="Cliente General"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-xs text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#FEE4D7] uppercase tracking-wider mb-1.5">
                Método de Pago
              </label>
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
                    className="w-full px-3 py-2 bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/40 rounded-xl text-sm font-bold text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:border-[#9F6839]"
                  />
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
          title="¡Venta Registrada Exitosamente!"
        >
          <div className="space-y-4 text-[#432414] dark:text-[#FEE4D7]">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm">
                  Orden #{lastOrder.order_number || 'Generada'}
                </h4>
                <p className="text-xs text-[#9F6839] dark:text-[#DABA8C]">
                  Comanda enviada a cocina. Total: <strong>${Number(lastOrder.total).toLocaleString('es-CO')}</strong>
                </p>
              </div>
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
    </div>
  )
}
