import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-white dark:bg-[#1E0F08] border border-[#D4B28E]/50 dark:border-[#9F6839]/30 rounded-2xl shadow-xl overflow-hidden modal-enter`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#D4B28E]/30 dark:border-[#9F6839]/20 bg-[#FEE4D7]/20 dark:bg-[#25120B]">
          <h3 className="text-sm font-bold text-[#432414] dark:text-[#FEE4D7] tracking-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana modal"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7]/60 dark:hover:bg-[#34180D] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F6839]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 max-h-[85vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
