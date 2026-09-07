import { useState } from 'react'
import {
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Maximize2,
  Printer,
  CreditCard,
  Instagram
} from 'lucide-react'
import Modal from '../components/Modal'

export default function QRCodes() {
  const [zoomModal, setZoomModal] = useState(null)
  const [copiedKey, setCopiedKey] = useState('')

  const qrItems = [
    {
      id: 'bold',
      title: 'QR de Cobro Bold',
      subtitle: 'Paga desde la app de cualquier entidad financiera en Colombia',
      handle: '@boldcaov5716',
      src: '/qr-bold.jpg',
      badge: 'Pagos & Transferencias',
      icon: CreditCard,
      badgeBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      externalUrl: null
    },
    {
      id: 'instagram',
      title: 'Instagram Toffee',
      subtitle: 'Escanea para seguir nuestra cuenta oficial y enterarte de novedades',
      handle: '@TOFFEE_CTGG',
      src: '/qr-instagram.jpg',
      badge: 'Redes Sociales',
      icon: Instagram,
      badgeBg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900',
      externalUrl: 'https://instagram.com/TOFFEE_CTGG'
    }
  ]

  function handleCopy(text, key) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2500)
  }

  function handleDownload(src, filename) {
    const link = document.createElement('a')
    link.href = src
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function handlePrint(src, title) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, sans-serif;
              background-color: #ffffff;
            }
            img {
              max-width: 90%;
              max-height: 85vh;
              object-fit: contain;
              border-radius: 16px;
            }
            h2 {
              margin-top: 16px;
              color: #432414;
              font-size: 20px;
            }
            @media print {
              body { margin: 0; }
              img { max-width: 100%; }
            }
          </style>
        </head>
        <body>
          <img src="${src}" alt="${title}" onload="window.print();window.close();" />
          <h2>${title}</h2>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="space-y-6 text-[#432414] dark:text-[#FEE4D7]">
      {/* Cabecera Principal */}
      <div className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FEE4D7] dark:bg-[#2A150C] rounded-2xl text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/60 dark:border-[#9F6839]/40">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#432414] dark:text-[#FEE4D7]">
              Códigos QR Oficiales
            </h1>
            <p className="text-xs font-semibold text-[#9F6839] dark:text-[#DABA8C] mt-0.5">
              Acceso rápido a códigos QR de cobro, transferencias y redes sociales
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Códigos QR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {qrItems.map((qr) => {
          const Icon = qr.icon
          const isCopied = copiedKey === qr.id

          return (
            <div
              key={qr.id}
              className="bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6 transition-all hover:shadow-md"
            >
              {/* Encabezado de la Tarjeta */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${qr.badgeBg}`}>
                    {qr.badge}
                  </span>
                  <div className="p-2 rounded-xl bg-[#FEE4D7]/50 dark:bg-[#2A150C] text-[#9F6839] dark:text-[#DABA8C]">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-black text-[#432414] dark:text-[#FEE4D7]">
                    {qr.title}
                  </h2>
                  <p className="text-xs text-[#9F6839] dark:text-[#DABA8C] font-medium leading-relaxed mt-1">
                    {qr.subtitle}
                  </p>
                </div>
              </div>

              {/* Imagen del Código QR */}
              <div className="relative group flex justify-center items-center p-4 bg-[#FEE4D7]/30 dark:bg-[#140505] rounded-2xl border border-[#D4B28E]/40 dark:border-[#9F6839]/30">
                <img
                  src={qr.src}
                  alt={qr.title}
                  className="w-64 h-64 md:w-72 md:h-72 object-contain rounded-xl shadow-xs transition-transform duration-200 group-hover:scale-[1.02]"
                />
                <button
                  type="button"
                  onClick={() => setZoomModal(qr)}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center text-white gap-2 backdrop-blur-xs cursor-pointer"
                >
                  <div className="p-3 bg-white/20 rounded-full">
                    <Maximize2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold tracking-wide">Clic para ver en grande</span>
                </button>
              </div>

              {/* Llave / Usuario y Acciones */}
              <div className="space-y-3 pt-1 border-t border-[#D4B28E]/40 dark:border-[#9F6839]/30">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FEE4D7]/40 dark:bg-[#2A150C] text-xs font-bold">
                  <span className="text-[#9F6839] dark:text-[#DABA8C] font-semibold">Usuario / Llave:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#432414] dark:text-[#FEE4D7] font-black">{qr.handle}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(qr.handle, qr.id)}
                      className="p-1 rounded-lg hover:bg-white/60 dark:hover:bg-[#3E2114] text-[#9F6839] dark:text-[#DABA8C] transition-colors cursor-pointer"
                      title="Copiar usuario"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setZoomModal(qr)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 text-xs font-bold hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
                    <span>Ampliar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownload(qr.src, `${qr.id}-toffee.jpg`)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 text-xs font-bold hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
                    <span>Descargar</span>
                  </button>

                  {qr.externalUrl ? (
                    <a
                      href={qr.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-100/60 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePrint(qr.src, qr.title)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 text-xs font-bold hover:bg-[#FEE4D7]/50 dark:hover:bg-[#3E2114] transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#9F6839] dark:text-[#DABA8C]" />
                      <span>Imprimir</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL DE ZOOM / PANTALLA COMPLETA */}
      {zoomModal && (
        <Modal
          isOpen={Boolean(zoomModal)}
          onClose={() => setZoomModal(null)}
          title={zoomModal.title}
        >
          <div className="space-y-4 text-center">
            <p className="text-xs text-[#9F6839] dark:text-[#DABA8C] font-semibold">
              {zoomModal.subtitle}
            </p>

            <div className="flex justify-center p-3 bg-[#FEE4D7]/40 dark:bg-[#140505] rounded-2xl border border-[#D4B28E]/40 dark:border-[#9F6839]/30">
              <img
                src={zoomModal.src}
                alt={zoomModal.title}
                className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>

            <div className="flex items-center justify-center gap-2 p-2 bg-[#FEE4D7]/50 dark:bg-[#2A150C] rounded-xl text-xs font-mono font-bold">
              <span>{zoomModal.handle}</span>
              <button
                type="button"
                onClick={() => handleCopy(zoomModal.handle, 'zoom')}
                className="p-1 rounded hover:bg-white/60 dark:hover:bg-[#3E2114] text-[#9F6839] dark:text-[#DABA8C]"
              >
                {copiedKey === 'zoom' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D4B28E]/40 dark:border-[#9F6839]/30">
              <button
                type="button"
                onClick={() => handleDownload(zoomModal.src, `${zoomModal.id}-toffee.jpg`)}
                className="px-4 py-2 bg-white dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/40 rounded-xl text-xs font-bold text-[#432414] dark:text-[#FEE4D7] hover:bg-[#FEE4D7]/50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrint(zoomModal.src, zoomModal.title)}
                className="px-4 py-2 bg-[#9F6839] hover:bg-[#835229] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
