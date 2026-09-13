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
      className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-white dark:bg-[#201009] border border-[#D4B28E]/80 dark:border-[#9F6839]/60 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4B28E]/40 dark:border-[#9F6839]/30 bg-[#FEE4D7]/30 dark:bg-[#2A150C]">
          <h3 className="text-lg font-extrabold text-[#432414] dark:text-[#FEE4D7] tracking-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#9F6839] dark:text-[#DABA8C] hover:bg-[#FEE4D7] dark:hover:bg-[#34180D] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F6839]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[85vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
