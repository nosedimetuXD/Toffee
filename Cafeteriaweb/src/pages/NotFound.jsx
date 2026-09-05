import { useNavigate, Link } from 'react-router-dom'
import { Home, ArrowLeft, Coffee, AlertCircle } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FEE4D7]/30 dark:bg-[#150a06] text-[#432414] dark:text-[#FEE4D7] p-4 relative overflow-hidden select-none">
      {/* Patrones de fondo decorativos */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#9F6839]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#D4B28E]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-8 shadow-xl relative z-10 text-center">
        {/* Logo o Icono de Marca */}
        <div className="relative inline-block mb-4">
          <img
            src="/icon-192.png"
            alt="Toffee Logo"
            className="w-20 h-20 rounded-3xl shadow-md object-cover mx-auto border-2 border-[#9F6839]/40 p-1 bg-white dark:bg-[#2A150C]"
          />
        </div>

        {/* Indicador 404 */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FEE4D7] dark:bg-[#2A150C] border border-[#D4B28E]/70 dark:border-[#9F6839]/50 text-xs font-black text-[#9F6839] dark:text-[#DABA8C] tracking-widest uppercase mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-[#9F6839]" />
          <span>Error 404</span>
        </div>

        <h1 className="text-3xl font-black tracking-tight text-[#432414] dark:text-[#FEE4D7]">
          Página No Encontrada
        </h1>

        <p className="text-xs font-semibold text-[#9F6839] dark:text-[#DABA8C] mt-2 leading-relaxed">
          La ruta a la que intentas ingresar no existe, fue movida o no está disponible en la cafetería.
        </p>

        {/* Botones de Navegación */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FEE4D7]/50 dark:bg-[#2A150C] hover:bg-[#FEE4D7] dark:hover:bg-[#341B0F] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 text-[#432414] dark:text-[#FEE4D7] font-bold text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#9F6839]" />
            <span>Volver Atrás</span>
          </button>

          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#9F6839] hover:bg-[#835229] text-white font-black text-xs shadow-md shadow-[#9F6839]/30 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Ir al Inicio / POS</span>
          </Link>
        </div>

        {/* Footer sutil */}
        <div className="mt-8 pt-4 border-t border-[#D4B28E]/30 dark:border-[#9F6839]/30 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#9F6839]/70 dark:text-[#DABA8C]/60 uppercase tracking-widest">
          <Coffee className="w-3.5 h-3.5 text-[#9F6839]" />
          <span>Toffee Coffee</span>
        </div>
      </div>
    </div>
  )
}
