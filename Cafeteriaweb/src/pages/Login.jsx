import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Coffee, Lock, User, Sparkles } from 'lucide-react'
import { ToffeeMarblePattern } from '../components/ToffeeMarblePattern'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative bg-[#150904] overflow-hidden p-4">
      {/* Background Official Toffe Pattern */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: "url('/toffe-pattern-dark.png')" }}
      />

      <div className="relative w-full max-w-md bg-white dark:bg-[#201009] border border-[#D4B28E]/60 dark:border-[#9F6839]/40 rounded-3xl p-8 shadow-2xl z-10 backdrop-blur-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#432414] dark:bg-[#34180D] border-2 border-[#9F6839] shadow-md mb-4 overflow-hidden p-1">
            <img src="/icon-512.png" alt="Toffee Logo" className="w-full h-full object-cover rounded-xl" />
          </div>
            <span className="font-extrabold text-[#432414] dark:text-[#FEE4D7] text-2xl tracking-tight leading-none block">
              Toffee
            </span>
          <p className="text-xs font-bold text-[#9F6839] dark:text-[#DABA8C] uppercase tracking-widest mt-1">
            "Hecho por y para estudiantes"
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEE4D7] dark:bg-[#2E180E] text-[10px] font-extrabold text-[#9F6839] dark:text-[#DABA8C] border border-[#D4B28E]/50">
            <Sparkles className="w-3 h-3" />
            Acceso Multiusuario / Caja Simultánea
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 p-3 rounded-2xl text-xs font-bold text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
              Nombre de Usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="w-4 h-4 text-[#9F6839]" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                required
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#FEE4D7]/20 dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/60 text-sm font-semibold text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:ring-2 focus:ring-[#9F6839]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#432414] dark:text-[#DABA8C] uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-[#9F6839]" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#FEE4D7]/20 dark:bg-[#150904] border border-[#D4B28E] dark:border-[#9F6839]/60 text-sm font-semibold text-[#432414] dark:text-[#FEE4D7] focus:outline-none focus:ring-2 focus:ring-[#9F6839]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3.5 px-4 rounded-2xl bg-[#9F6839] hover:bg-[#835229] text-white font-extrabold text-sm shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar a Caja / Sistema'}
          </button>
        </form>

        <p className="text-center text-[10px] font-semibold text-[#9F6839] dark:text-[#DABA8C]/70 mt-6">
          Toffee Web App &copy; {new Date().getFullYear()} — Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}