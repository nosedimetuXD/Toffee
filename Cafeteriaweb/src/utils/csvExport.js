/**
 * Utilidad universal para exportación de datos a formato CSV/Excel con codificación UTF-8 BOM.
 */

function downloadCSV(filename, csvContent) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

export function exportSalesToCSV(sales, filename = 'ventas_toffee.csv') {
  if (!sales || sales.length === 0) {
    alert('No hay ventas para exportar')
    return
  }

  const headers = [
    'ID Venta',
    'Fecha y Hora',
    'Vendedor',
    'Cliente',
    'Método de Pago',
    'Detalles de Banco',
    'Efectivo Recibido',
    'Transferencia Recibida',
    'Subtotal',
    'Descuento (%)',
    'Descuento ($)',
    'Motivo Descuento',
    'Total Pagado',
    'Estado',
    'Detalle de Productos'
  ]

  const rows = sales.map((s) => {
    const itemsStr = (s.items || [])
      .map((i) => `${i.product_name || 'Producto'} (x${i.quantity}) - $${Number(i.unit_price || 0).toLocaleString('es-CO')}`)
      .join(' | ')

    return [
      escapeCSV(s.id),
      escapeCSV(new Date(s.created_at).toLocaleString('es-CO')),
      escapeCSV(s.sold_by_username || 'Personal'),
      escapeCSV(s.customer_name || 'Cliente General'),
      escapeCSV(s.payment_method || 'efectivo'),
      escapeCSV(s.bank_details || ''),
      escapeCSV(s.cash_amount || 0),
      escapeCSV(s.transfer_amount || 0),
      escapeCSV(s.subtotal || s.total || 0),
      escapeCSV(s.discount_percent || 0),
      escapeCSV(s.discount_amount || 0),
      escapeCSV(s.discount_reason || ''),
      escapeCSV(s.total || 0),
      escapeCSV((s.status || 'completada').toUpperCase()),
      escapeCSV(itemsStr)
    ].join(',')
  })

  const csvContent = [headers.join(','), ...rows].join('\r\n')
  downloadCSV(filename, csvContent)
}

export function exportAccountingToCSV(expenses = [], incomes = [], filename = 'contabilidad_toffee.csv') {
  const headers = [
    'Tipo de Movimiento',
    'ID',
    'Fecha y Hora',
    'Descripción',
    'Categoría',
    'Método de Pago',
    'Monto ($)',
    'Insumo Afectado',
    'Cantidad Insumo',
    'Registrado Por'
  ]

  const rows = []

  expenses.forEach((e) => {
    rows.push(
      [
        escapeCSV('GASTO / EGRESO'),
        escapeCSV(e.id),
        escapeCSV(new Date(e.created_at).toLocaleString('es-CO')),
        escapeCSV(e.description),
        escapeCSV(e.category),
        escapeCSV(e.payment_method),
        escapeCSV(e.amount),
        escapeCSV(e.ingredient_name || ''),
        escapeCSV(e.quantity_added ? `+${e.quantity_added}` : ''),
        escapeCSV(e.registerer_name || 'Personal')
      ].join(',')
    )
  })

  incomes.forEach((i) => {
    rows.push(
      [
        escapeCSV('INGRESO EXTRAORDINARIO'),
        escapeCSV(i.id),
        escapeCSV(new Date(i.created_at).toLocaleString('es-CO')),
        escapeCSV(i.description),
        escapeCSV(i.category),
        escapeCSV(i.payment_method),
        escapeCSV(i.amount),
        escapeCSV(''),
        escapeCSV(''),
        escapeCSV(i.registerer_name || 'Personal')
      ].join(',')
    )
  })

  const csvContent = [headers.join(','), ...rows].join('\r\n')
  downloadCSV(filename, csvContent)
}

export function exportCustomersToCSV(customers, filename = 'clientes_toffee.csv') {
  if (!customers || customers.length === 0) {
    alert('No hay clientes para exportar')
    return
  }

  const headers = [
    'ID Cliente',
    'Nombre',
    'Apellido',
    'Teléfono',
    'Email',
    'Preferencias y Notas',
    'Total Consumido ($)',
    'Total Pedidos',
    'Última Visita',
    'Registrado Por',
    'Fecha Registro'
  ]

  const rows = customers.map((c) => {
    return [
      escapeCSV(c.id),
      escapeCSV(c.first_name),
      escapeCSV(c.last_name || ''),
      escapeCSV(c.phone || ''),
      escapeCSV(c.email || ''),
      escapeCSV(c.notes || ''),
      escapeCSV(c.total_spent || 0),
      escapeCSV(c.total_orders || 0),
      escapeCSV(c.last_order_date ? new Date(c.last_order_date).toLocaleString('es-CO') : 'Sin compras'),
      escapeCSV(c.created_by_username || 'Personal'),
      escapeCSV(new Date(c.created_at).toLocaleString('es-CO'))
    ].join(',')
  })

  const csvContent = [headers.join(','), ...rows].join('\r\n')
  downloadCSV(filename, csvContent)
}
