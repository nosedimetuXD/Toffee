import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { compressAndReadFile } from '../utils/imageUtils'
import { Coffee, Plus, Edit2, Trash2, Search, BookOpen, Image as ImageIcon, Upload, CheckCircle2, XCircle, AlertTriangle, Zap } from 'lucide-react'

const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80'

export default function Products() {
  const { user } = useAuth()
  const userRole = (user?.role || '').toLowerCase()
  const isEmployee = userRole === 'empleado' || userRole === 'employee' || !['owner', 'admin'].includes(userRole)

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Modal Crear / Editar Producto
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Café')
  const [imageUrl, setImageUrl] = useState('')
  const [requiresPreparation, setRequiresPreparation] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  async function loadProducts() {
    try {
      const data = await api.get('/products')
      setProducts(data || [])

      const cats = Array.from(new Set((data || []).map((p) => p.category))).filter(Boolean)
      setCategories(['Todos', ...cats])
    } catch (err) {
      setPageError('No se pudieron cargar los productos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  function openCreateModal() {
    setEditingProduct(null)
    setName('')
    setDescription('')
    setPrice('')
    setCategory('Café')
    setImageUrl('')
    setRequiresPreparation(true)
    setIsActive(true)
    setFormError('')
    setIsModalOpen(true)
  }

  function openEditModal(prod) {
    setEditingProduct(prod)
    setName(prod.name)
    setDescription(prod.description || '')
    setPrice(String(prod.price))
    setCategory(prod.category || 'Café')
    setImageUrl(prod.image_url || '')
    setRequiresPreparation(prod.requires_preparation ?? true)
    const currentActive = typeof prod.active !== 'undefined' ? prod.active : (prod.is_active ?? true)
    setIsActive(currentActive)
    setFormError('')
    setIsModalOpen(true)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    compressAndReadFile(file, (compressedDataUrl) => {
      setImageUrl(compressedDataUrl)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        category: category.trim() || 'Café',
        image_url: imageUrl.trim(),
        requires_preparation: requiresPreparation,
        active: isActive,
        is_active: isActive
      }

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload)
      } else {
        await api.post('/products', payload)
      }

      setIsModalOpen(false)
      await loadProducts()
    } catch (err) {
      setFormError(err.message || 'No se pudo guardar el producto')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleProductActive(prod, e) {
    e.stopPropagation()
    const currentActive = typeof prod.active !== 'undefined' ? prod.active : (prod.is_active ?? true)
    try {
      await api.put(`/products/${prod.id}`, {
        name: prod.name,
        description: prod.description || '',
        price: prod.price,
        category: prod.category || 'Café',
        image_url: prod.image_url || '',
        requires_preparation: prod.requires_preparation ?? true,
        active: !currentActive,
        is_active: !currentActive
      })
      await loadProducts()
    } catch (err) {
      alert('Error al cambiar el estado del producto')
    }
  }

  async function handleDelete(id, prodName) {
    if (!window.confirm(`¿Seguro que deseas eliminar el producto "${prodName}"?`)) return
    try {
      await api.delete(`/products/${id}`)
      await loadProducts()
    } catch (err) {
      console.error('Error eliminando producto:', err)
      alert(err.message || 'Error al eliminar producto')
    }
  }

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === 'Todos' || p.category === selectedCategory
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  if (loading) return <p className="p-4 text-sm font-semibold text-[#9F6839]">Cargando productos...</p>

  return (
    <div className="space-y-6 text-[#432414] dark:text-[#FEE4D7]">
      {/* Header */}
      <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#432414] dark:text-[#FEE4D7]">
              Catálogo de Productos & Menú Toffee
            </h1>
            <p className="text-xs text-[#9F6839] dark:text-[#DABA8C] mt-0.5">
              Configuración de precios, recetas, fotos e insumos consumidos
            </p>
          </div>
        </div>

        {!isEmployee && (
          <button type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#9F6839] hover:bg-[#835229] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        )}
      </div>

      {pageError && (
        <div className="p-3.5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
          {pageError}
        </div>
      )}

      {/* Buscador & Categorías */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9F6839] dark:text-[#DABA8C]" />
          <input
            type="text"
            placeholder="Buscar producto por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-xl pl-10 pr-3 py-2 text-xs text-[#432414] dark:text-[#FEE4D7] placeholder-[#9F6839]/60 dark:placeholder-[#DABA8C]/50 focus:outline-none focus:border-[#9F6839]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button type="button"
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#9F6839] text-white font-bold'
                  : 'bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/40 dark:border-[#9F6839]/30 text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7]/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Productos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((prod) => {
          const activeState = typeof prod.active !== 'undefined' ? prod.active : (prod.is_active ?? true)
          const img = prod.image_url || DEFAULT_PRODUCT_IMAGE

          return (
            <div
              key={prod.id}
              className={`bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 hover:border-[#9F6839] rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs transition-all group ${
                !activeState ? 'opacity-60' : ''
              }`}
            >
              <div>
                <div className="relative h-36 w-full bg-[#FEE4D7]/30 dark:bg-[#2A160D] overflow-hidden">
                  <img
                    src={img}
                    alt={prod.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.src = DEFAULT_PRODUCT_IMAGE
                    }}
                  />
                  <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                    <span className="px-2 py-0.5 rounded-md bg-[#201009]/85 text-[#FEE4D7] font-semibold text-[10px] backdrop-blur-xs shadow-xs">
                      {prod.category || 'General'}
                    </span>
                    {(prod.requires_preparation === false) && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-600/90 text-white font-bold text-[9px] backdrop-blur-xs shadow-xs flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        <span>Listo / Directo</span>
                      </span>
                    )}
                  </div>
                  <div className="absolute top-2 right-2">
                    <button
                      type="button"
                      disabled={isEmployee}
                      onClick={(e) => !isEmployee && toggleProductActive(prod, e)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium shadow-xs transition-transform ${
                        isEmployee ? 'cursor-default' : 'cursor-pointer hover:scale-105'
                      } ${
                        activeState
                          ? 'bg-emerald-500/90 text-white'
                          : 'bg-neutral-600/90 text-white'
                      }`}
                      title={isEmployee ? 'Estado de disponibilidad en POS' : 'Haz clic para activar o desactivar este producto'}
                    >
                      {activeState ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Inactivo
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3.5">
                  <h3 className="font-bold text-xs text-[#432414] dark:text-[#FEE4D7] truncate">{prod.name}</h3>
                  {prod.description && (
                    <p className="text-[11px] text-[#9F6839]/80 dark:text-[#DABA8C]/70 line-clamp-2 mt-1">
                      {prod.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="px-3.5 pb-3 pt-2 border-t border-[#D4B28E]/20 dark:border-[#9F6839]/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#9F6839]/70 dark:text-[#DABA8C]/60 block leading-tight">Precio Venta</span>
                  <span className="text-sm font-bold text-[#432414] dark:text-[#FEE4D7] tabular-nums">
                    ${prod.price.toLocaleString('es-CO')}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    to={`/products/${prod.id}/recipe`}
                    className="p-1.5 rounded-lg bg-[#FEE4D7]/40 dark:bg-[#2A160D] text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#9F6839] hover:text-white transition-colors flex items-center gap-1 text-[11px] font-semibold"
                    title={isEmployee ? "Ver Receta (Modo Lectura)" : "Ver / Editar Receta"}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    {isEmployee && <span className="text-[10px]">Receta</span>}
                  </Link>

                  {!isEmployee && (
                    <button type="button"
                      onClick={() => openEditModal(prod)}
                      className="p-1.5 rounded-lg text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/60 dark:hover:bg-[#34180D] transition-colors cursor-pointer"
                      title="Editar producto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!isEmployee && (
                    <button type="button"
                      onClick={() => handleDelete(prod.id, prod.name)}
                      className="p-1.5 rounded-lg text-[#9F6839] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Crear / Editar Producto */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? `Editar Producto: ${editingProduct.name}` : 'Nuevo Producto'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-2xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
              Nombre del Producto
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Capuccino 12oz"
              required
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] text-sm font-semibold text-[#432414] dark:text-[#FEE4D7]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
                Precio ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="6000"
                required
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] text-sm font-semibold text-[#432414] dark:text-[#FEE4D7]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
                Categoría
              </label>
              <input
                type="text"
                list="category-suggestions"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej. Café, Repostería"
                required
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] text-sm font-semibold text-[#432414] dark:text-[#FEE4D7]"
              />
              <datalist id="category-suggestions">
                <option value="Café" />
                <option value="Bebidas Frías" />
                <option value="Repostería" />
                <option value="Snacks" />
                <option value="Desayunos" />
                <option value="Especiales" />
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#9F6839]" /> Imagen del Producto
            </label>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#FEE4D7] dark:bg-[#2A150C] border border-[#D4B28E] hover:bg-[#9F6839] hover:text-white text-xs font-extrabold text-[#432414] dark:text-[#FEE4D7] transition-all cursor-pointer shadow-xs">
                <Upload className="w-4 h-4" />
                <span>Subir foto del dispositivo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-[#9F6839] font-medium">o escribe una URL</span>
            </div>

            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... o foto seleccionada"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] text-xs font-semibold text-[#432414] dark:text-[#FEE4D7]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
              Descripción
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas de sabor, preparación o presentación..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#150904] border border-[#D4B28E] text-sm font-semibold text-[#432414] dark:text-[#FEE4D7]"
            />
          </div>

          {/* Toggle Requiere Preparación */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requires-prep-check"
              checked={requiresPreparation}
              onChange={(e) => setRequiresPreparation(e.target.checked)}
              className="w-4 h-4 rounded text-[#9F6839] cursor-pointer"
            />
            <label htmlFor="requires-prep-check" className="text-xs font-bold text-[#432414] dark:text-[#FEE4D7] cursor-pointer">
              ¿Requiere preparación?
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-active-check"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-[#9F6839] cursor-pointer"
            />
            <label htmlFor="is-active-check" className="text-xs font-bold text-[#432414] dark:text-[#FEE4D7] cursor-pointer">
              Producto Activo y disponible para venta en POS
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-2xl bg-white dark:bg-[#201009] border border-[#D4B28E] text-xs font-bold text-[#432414] dark:text-[#FEE4D7] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-2xl bg-[#9F6839] hover:bg-[#835229] text-white text-xs font-extrabold shadow-md cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : editingProduct ? 'Actualizar Producto' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}