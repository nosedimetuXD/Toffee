import { jsPDF } from 'jspdf'

/**
 * Genera el documento jsPDF con el diseño estándar oficial para Toffee Coffee (tirilla 80mm).
 * @param {Object} order - Datos de la venta
 * @returns {Promise<jsPDF>}
 */
export async function createReceiptPDF(order) {
  const items = order.items || []
  const itemsCount = items.length
  const hasDiscount = (order.discount_amount || 0) > 0 || (order.discount_percent || 0) > 0
  const hasDebt = Number(order.pending_amount) > 0 || order.payment_method === 'credito'

  // Altura dinámica calculada según ítems y descuentos
  const dynamicHeight = Math.max(160, 115 + itemsCount * 9 + (hasDiscount ? 15 : 0) + (hasDebt ? 16 : 0))

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, dynamicHeight]
  })

  let y = 8

  // 1. Encabezado Oficial Toffee Coffee
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(67, 36, 20) // Color Toffee Dark Coffee #432414
  doc.text('TOFFEE COFFEE', 40, y + 2, { align: 'center' })
  y += 8

  // 2. Lema y Fecha
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(159, 104, 57) // Color Toffee Accent #9F6839
  doc.text('Espresso, Bakery & Specialty', 40, y, { align: 'center' })
  y += 4

  const dateStr = new Date(order.created_at || Date.now()).toLocaleString('es-CO')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(110, 110, 110)
  doc.text(dateStr, 40, y, { align: 'center' })
  y += 5.5

  // Línea divisoria
  doc.setDrawColor(220, 200, 190)
  doc.setLineWidth(0.3)
  doc.line(6, y, 74, y)
  y += 4.5

  // 3. Datos del Pedido
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(50, 50, 50)
  doc.text(`Cliente: ${order.customer_name || 'Cliente General'}`, 7, y)
  y += 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(90, 90, 90)
  doc.text(`Atendido por: ${order.sold_by_username || 'Barista Toffee'}`, 7, y)
  y += 4

  const paymentMethodLabel = (order.payment_method || 'efectivo').toUpperCase()
  doc.text(`Pago: ${paymentMethodLabel}${order.bank_details ? ` (${order.bank_details})` : ''}`, 7, y)
  y += 4.5

  // Línea divisoria tabla
  doc.setDrawColor(220, 200, 190)
  doc.line(6, y, 74, y)
  y += 4

  // 4. Encabezados de Tabla de Productos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(100, 70, 50)
  doc.text('Cant', 7, y)
  doc.text('Producto', 17, y)
  doc.text('Total', 73, y, { align: 'right' })
  y += 3

  doc.setDrawColor(240, 230, 220)
  doc.line(6, y, 74, y)
  y += 3.5

  // 5. Lista de Ítems
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(40, 40, 40)

  items.forEach((item) => {
    const qty = `${item.quantity}x`
    const rawName = item.product_name || item.name || 'Producto'
    const name = rawName.length > 22 ? rawName.substring(0, 20) + '..' : rawName
    const itemTotal = `$${Number((item.unit_price || 0) * item.quantity).toLocaleString('es-CO')}`

    doc.setFont('helvetica', 'bold')
    doc.text(qty, 7, y)

    doc.setFont('helvetica', 'normal')
    doc.text(name, 17, y)
    doc.text(itemTotal, 73, y, { align: 'right' })
    y += 4.5
  })

  y += 1
  doc.setDrawColor(220, 200, 190)
  doc.line(6, y, 74, y)
  y += 4.5

  // 6. Subtotal, Descuentos y Total
  if (hasDiscount) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(90, 90, 90)
    doc.text('Subtotal:', 7, y)
    doc.text(`$${Number(order.subtotal || order.total).toLocaleString('es-CO')}`, 73, y, { align: 'right' })
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 50, 50)
    const discountText = order.discount_percent > 0 ? `Descuento (${order.discount_percent}%):` : 'Descuento:'
    doc.text(discountText, 7, y)
    doc.text(`-$${Number(order.discount_amount || 0).toLocaleString('es-CO')}`, 73, y, { align: 'right' })
    y += 4
  }

  // TOTAL
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(67, 36, 20)
  doc.text('TOTAL:', 7, y + 1)
  doc.text(`$${Number(order.total || 0).toLocaleString('es-CO')}`, 73, y + 1, { align: 'right' })
  y += 6

  if (hasDebt) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(16, 120, 60)
    doc.text('Abonado hoy:', 7, y)
    doc.text(`$${Number(order.paid_amount || 0).toLocaleString('es-CO')}`, 73, y, { align: 'right' })
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(180, 50, 50)
    doc.text('Saldo Pendiente (Deuda):', 7, y)
    const pendingVal = Number(order.pending_amount || (order.payment_method === 'credito' ? order.total : 0))
    doc.text(`$${pendingVal.toLocaleString('es-CO')}`, 73, y, { align: 'right' })
    y += 5
  }

  // 7. Pie de página
  doc.setDrawColor(220, 200, 190)
  doc.line(6, y, 74, y)
  y += 4.5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 60, 40)
  doc.text('¡Gracias por tu compra en Toffee!', 40, y, { align: 'center' })
  y += 3.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(140, 140, 140)
  doc.text('Disfruta tu café del día', 40, y, { align: 'center' })

  return doc
}

/**
 * Descarga el comprobante PDF en el dispositivo.
 */
export async function downloadReceiptPDF(order) {
  try {
    const doc = await createReceiptPDF(order)
    const orderIdSuffix = String(order.id || Date.now()).substring(0, 8)
    doc.save(`ticket_toffee_${orderIdSuffix}.pdf`)
  } catch (err) {
    console.error('Error generando PDF:', err)
    alert('No se pudo generar el comprobante PDF.')
  }
}

/**
 * Abre el diálogo de impresión nativo del navegador para el comprobante.
 */
export async function printReceiptPDF(order) {
  try {
    const doc = await createReceiptPDF(order)
    const blobUrl = doc.output('bloburl')
    const printWindow = window.open(blobUrl, '_blank')
    if (printWindow) {
      printWindow.focus()
    }
  } catch (err) {
    console.error('Error imprimiendo PDF:', err)
    alert('No se pudo abrir el comprobante para imprimir.')
  }
}

/**
 * Genera el mensaje estructurado de WhatsApp y abre el chat directamente.
 */
export function shareReceiptPDFToWhatsApp(order, phone = '') {
  try {
    const items = order.items || []
    const itemsText = items
      .map((i) => `• *${i.quantity}x* ${i.product_name || 'Producto'} - $${Number((i.unit_price || 0) * i.quantity).toLocaleString('es-CO')}`)
      .join('\n')

    let discountInfo = ''
    if ((order.discount_amount || 0) > 0) {
      discountInfo = `\n*Descuento:* -$${Number(order.discount_amount).toLocaleString('es-CO')}`
    }

    const hasDebt = Number(order.pending_amount) > 0 || order.payment_method === 'credito'
    let debtInfo = ''
    if (hasDebt) {
      const pendingVal = Number(order.pending_amount || (order.payment_method === 'credito' ? order.total : 0))
      debtInfo = `\n*Abonado:* $${Number(order.paid_amount || 0).toLocaleString('es-CO')}\n*SALDO PENDIENTE (DEUDA):* *$${pendingVal.toLocaleString('es-CO')}*`
    }

    const message = `*COMPROBANTE DE COMPRA - TOFFEE COFFEE*\n\n` +
      `*Cliente:* ${order.customer_name || 'Cliente General'}\n` +
      `*Fecha:* ${new Date(order.created_at || Date.now()).toLocaleString('es-CO')}\n` +
      `*Método de Pago:* ${(order.payment_method || 'Efectivo').toUpperCase()}${order.bank_details ? ` (${order.bank_details})` : ''}\n\n` +
      `*Detalle del Pedido:*\n${itemsText}\n` +
      `${discountInfo}\n` +
      `*TOTAL:* *$${Number(order.total || 0).toLocaleString('es-CO')}*` +
      `${debtInfo}\n\n` +
      `¡Muchas gracias por tu visita! Esperamos que disfrutes tu café.`

    const cleanPhone = (phone || '').replace(/\D/g, '')
    const url = cleanPhone
      ? `https://wa.me/57${cleanPhone.replace(/^57/, '')}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`

    window.open(url, '_blank')
  } catch (err) {
    console.error('Error compartiendo a WhatsApp:', err)
    alert('No se pudo generar el enlace de WhatsApp.')
  }
}
