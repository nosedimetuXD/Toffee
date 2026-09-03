// Utilidades de conversión y formateo de unidades de medida (masa, volumen, unidades)

export const AVAILABLE_UNITS = [
  { value: 'L', label: 'Litros (L)', type: 'volume' },
  { value: 'ml', label: 'Mililitros (ml)', type: 'volume' },
  { value: 'kg', label: 'Kilogramos (kg)', type: 'mass' },
  { value: 'g', label: 'Gramos (g)', type: 'mass' },
  { value: 'mg', label: 'Miligramos (mg)', type: 'mass' },
  { value: 'oz', label: 'Onzas (oz)', type: 'mass' },
  { value: 'unidad', label: 'Unidades (un)', type: 'unit' }
]

/**
 * Convierte un valor desde una unidad origen a una unidad destino.
 * Ejemplos:
 * convertQuantity(200, 'ml', 'L') => 0.2
 * convertQuantity(300, 'ml', 'L') => 0.3
 * convertQuantity(500, 'g', 'kg') => 0.5
 * convertQuantity(2, 'kg', 'g') => 2000
 */
export function convertQuantity(value, fromUnit, toUnit) {
  const val = Number(value)
  if (isNaN(val) || val <= 0) return 0
  if (!fromUnit || !toUnit) return val

  const uFrom = fromUnit.trim().toLowerCase()
  const uTo = toUnit.trim().toLowerCase()

  if (uFrom === uTo) return val

  // Conversiones de Volumen (ml <-> L)
  if (uFrom === 'ml' && (uTo === 'l' || uTo === 'litros' || uTo === 'litro')) return val / 1000
  if ((uFrom === 'l' || uFrom === 'litros' || uFrom === 'litro') && uTo === 'ml') return val * 1000

  // Conversiones de Masa (mg <-> g <-> kg)
  if (uFrom === 'mg' && uTo === 'g') return val / 1000
  if (uFrom === 'mg' && uTo === 'kg') return val / 1000000
  if (uFrom === 'g' && uTo === 'kg') return val / 1000
  if (uFrom === 'g' && uTo === 'mg') return val * 1000
  if (uFrom === 'kg' && uTo === 'g') return val * 1000
  if (uFrom === 'kg' && uTo === 'mg') return val * 1000000

  // Onzas (oz)
  if (uFrom === 'oz' && uTo === 'g') return val * 28.3495
  if (uFrom === 'oz' && uTo === 'kg') return (val * 28.3495) / 1000
  if (uFrom === 'oz' && uTo === 'ml') return val * 29.5735
  if (uFrom === 'oz' && (uTo === 'l' || uTo === 'litros')) return (val * 29.5735) / 1000

  return val
}

/**
 * Retorna un texto explicativo de la conversión automática si las unidades difieren.
 * Ej: formatConvertedHint(200, 'ml', 'L') => "200 ml -> 0.2 L"
 */
export function formatConvertedHint(value, fromUnit, toUnit) {
  const val = Number(value)
  if (!val || !fromUnit || !toUnit) return null
  if (fromUnit.trim().toLowerCase() === toUnit.trim().toLowerCase()) return null
  const converted = convertQuantity(val, fromUnit, toUnit)
  const formattedConverted = converted % 1 === 0 ? converted : Number(converted.toFixed(4))
  return `${val} ${fromUnit} -> ${formattedConverted} ${toUnit}`
}
