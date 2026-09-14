import React, { useState, useId, useMemo } from 'react'

function getSmoothPath(points) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`

  let d = `M ${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i < points.length - 2 ? points[i + 2] : p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

export default function MetricLineChart({
  data = [],
  line1Color = '#9F6839',
  line2Color = '#f43f5e',
  line1Label = 'Serie 1',
  line2Label = '',
  hasSecondary = false,
  formatValue = (v) => `$${Number(v || 0).toLocaleString('es-CO')}`,
  height = 140
}) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const uniqueId = useId().replace(/:/g, '')

  const processedData = useMemo(() => {
    if (!data || data.length === 0) {
      return [
        { label: 'P1', value: 0, secondaryValue: 0 },
        { label: 'P2', value: 0, secondaryValue: 0 },
        { label: 'P3', value: 0, secondaryValue: 0 },
        { label: 'P4', value: 0, secondaryValue: 0 },
        { label: 'P5', value: 0, secondaryValue: 0 }
      ]
    }
    if (data.length === 1) {
      return [
        { label: 'Inicio', value: 0, secondaryValue: 0 },
        { label: data[0].label, value: data[0].value, secondaryValue: data[0].secondaryValue || 0 }
      ]
    }
    return data
  }, [data])

  const svgWidth = 600
  const svgHeight = 160
  const padding = { top: 15, right: 20, bottom: 28, left: 55 }
  const plotWidth = svgWidth - padding.left - padding.right
  const plotHeight = svgHeight - padding.top - padding.bottom

  const maxValue = useMemo(() => {
    const allVals = processedData.flatMap((d) => [
      Number(d.value) || 0,
      hasSecondary ? Number(d.secondaryValue) || 0 : 0
    ])
    const max = Math.max(...allVals, 1000)
    return max * 1.15
  }, [processedData, hasSecondary])

  const points1 = useMemo(() => {
    return processedData.map((d, i) => {
      const x = padding.left + (i / (processedData.length - 1)) * plotWidth
      const val = Number(d.value) || 0
      const y = padding.top + plotHeight - (val / maxValue) * plotHeight
      return { x, y, data: d, val }
    })
  }, [processedData, maxValue, plotWidth, plotHeight, padding])

  const points2 = useMemo(() => {
    if (!hasSecondary) return []
    return processedData.map((d, i) => {
      const x = padding.left + (i / (processedData.length - 1)) * plotWidth
      const val = Number(d.secondaryValue) || 0
      const y = padding.top + plotHeight - (val / maxValue) * plotHeight
      return { x, y, data: d, val }
    })
  }, [processedData, maxValue, hasSecondary, plotWidth, plotHeight, padding])

  const line1Path = useMemo(() => getSmoothPath(points1), [points1])
  const line2Path = useMemo(() => getSmoothPath(points2), [points2])

  const area1Path = useMemo(() => {
    if (points1.length === 0) return ''
    const baselineY = padding.top + plotHeight
    return `${line1Path} L ${points1[points1.length - 1].x},${baselineY} L ${points1[0].x},${baselineY} Z`
  }, [line1Path, points1, padding, plotHeight])

  const gridSteps = [0, 0.33, 0.66, 1]
  const activePoint1 = hoverIndex !== null ? points1[hoverIndex] : null
  const activePoint2 = hoverIndex !== null && hasSecondary ? points2[hoverIndex] : null

  return (
    <div className="relative w-full select-none" style={{ height: `${height}px` }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`grad1-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={line1Color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={line1Color} stopOpacity="0.0" />
          </linearGradient>

          {hasSecondary && (
            <linearGradient id={`grad2-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={line2Color} stopOpacity="0.20" />
              <stop offset="100%" stopColor={line2Color} stopOpacity="0.0" />
            </linearGradient>
          )}
        </defs>

        {/* Cuadrícula Horizontal (Gridlines) */}
        {gridSteps.map((step, idx) => {
          const y = padding.top + plotHeight - step * plotHeight
          const labelVal = maxValue * step
          return (
            <g key={`grid-h-${idx}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={svgWidth - padding.right}
                y2={y}
                stroke="currentColor"
                className="text-[#D4B28E]/40 dark:text-[#9F6839]/30"
                strokeWidth="1"
                strokeDasharray={idx === 0 ? undefined : '3 3'}
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#9F6839]/80 dark:fill-[#DABA8C]/70 text-[9px] font-mono tabular-nums"
              >
                {labelVal >= 1000000
                  ? `$${(labelVal / 1000000).toFixed(1)}M`
                  : labelVal >= 1000
                  ? `$${Math.round(labelVal / 1000)}k`
                  : `$${Math.round(labelVal)}`}
              </text>
            </g>
          )
        })}

        {/* Cuadrícula Vertical (Gridlines en cada punto) */}
        {points1.map((p, idx) => (
          <line
            key={`grid-v-${idx}`}
            x1={p.x}
            y1={padding.top}
            x2={p.x}
            y2={padding.top + plotHeight}
            stroke="currentColor"
            className="text-[#D4B28E]/25 dark:text-[#9F6839]/20"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        ))}

        {/* Área bajo la curva 1 */}
        <path d={area1Path} fill={`url(#grad1-${uniqueId})`} />

        {/* Curva Serie 2 */}
        {hasSecondary && line2Path && (
          <path
            d={line2Path}
            fill="none"
            stroke={line2Color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Curva Serie 1 */}
        {line1Path && (
          <path
            d={line1Path}
            fill="none"
            stroke={line1Color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Guía vertical activa (Hover crosshair) */}
        {hoverIndex !== null && points1[hoverIndex] && (
          <line
            x1={points1[hoverIndex].x}
            y1={padding.top}
            x2={points1[hoverIndex].x}
            y2={padding.top + plotHeight}
            stroke="#9F6839"
            className="dark:stroke-[#DABA8C]"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}

        {/* Puntos Serie 2 (Círculos) */}
        {hasSecondary &&
          points2.map((p, idx) => {
            const isHovered = hoverIndex === idx
            return (
              <circle
                key={`p2-${idx}`}
                cx={p.x}
                cy={p.y}
                r={isHovered ? 5.5 : 3.5}
                fill={line2Color}
                className="stroke-white dark:stroke-[#1E0F08] transition-all duration-150"
                strokeWidth={isHovered ? 2.5 : 1.5}
              />
            )
          })}

        {/* Puntos Serie 1 (Círculos estilo imagen referencia) */}
        {points1.map((p, idx) => {
          const isHovered = hoverIndex === idx
          return (
            <circle
              key={`p1-${idx}`}
              cx={p.x}
              cy={p.y}
              r={isHovered ? 5.5 : 3.5}
              fill={line1Color}
              className="stroke-white dark:stroke-[#1E0F08] transition-all duration-150"
              strokeWidth={isHovered ? 2.5 : 1.5}
            />
          )
        })}

        {/* Etiquetas Eje X */}
        {points1.map((p, idx) => {
          const shouldShow = processedData.length <= 8 || idx % 2 === 0 || idx === processedData.length - 1
          if (!shouldShow) return null

          return (
            <text
              key={`label-x-${idx}`}
              x={p.x}
              y={padding.top + plotHeight + 16}
              textAnchor="middle"
              className={
                'text-[9px] font-mono ' +
                (hoverIndex === idx
                  ? 'fill-[#432414] dark:fill-[#FEE4D7] font-bold'
                  : 'fill-[#9F6839]/80 dark:fill-[#DABA8C]/70 font-normal')
              }
            >
              {p.data.label}
            </text>
          )
        })}

        {/* Zonas de interacción */}
        {points1.map((p, idx) => (
          <rect
            key={`touch-${idx}`}
            x={p.x - plotWidth / (points1.length * 2)}
            y={padding.top}
            width={plotWidth / points1.length}
            height={plotHeight + 20}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoverIndex(idx)}
            onMouseLeave={() => setHoverIndex(null)}
            onTouchStart={() => setHoverIndex(idx)}
          />
        ))}
      </svg>

      {/* Floating Tooltip */}
      {hoverIndex !== null && activePoint1 && (
        <div
          className="absolute pointer-events-none z-30 transition-all duration-100 ease-out bg-[#432414] dark:bg-[#2A160D] text-[#FEE4D7] border border-[#D4B28E]/40 rounded-xl px-2.5 py-1.5 shadow-xl text-left"
          style={{
            left: `${(activePoint1.x / svgWidth) * 100}%`,
            top: `${Math.max((activePoint1.y / svgHeight) * 100 - 45, 0)}%`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="text-[10px] font-semibold text-[#DABA8C] border-b border-[#D4B28E]/20 pb-0.5 mb-1 whitespace-nowrap">
            {activePoint1.data.label}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: line1Color }} />
            <span>{line1Label}:</span>
            <span className="tabular-nums font-mono">{formatValue(activePoint1.val)}</span>
          </div>
          {hasSecondary && activePoint2 && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300 mt-0.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: line2Color }} />
              <span>{line2Label}:</span>
              <span className="tabular-nums font-mono">{formatValue(activePoint2.val)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
