/* eslint-disable react-refresh/only-export-components */
import { useState, useCallback, createContext, useContext } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type ToastItem = { id: number; message: string; type: ToastType }

const ToastContext = createContext<{ show: (msg: string, type?: ToastType) => void }>({ show: () => {} })

export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)) }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => <ToastBubble key={t.id} item={t} onClose={() => setToasts(prev => prev.filter(p => p.id !== t.id))} />)}
      </div>
    </ToastContext.Provider>
  )
}

function ToastBubble({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible] = useState(true)

  const icons: Record<ToastType, string> = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' }
  const colors: Record<ToastType, string> = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b',
  }

  return (
    <div className="toast-bubble" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderRadius: 14,
      background: '#fff', border: `1px solid ${colors[item.type]}30`, boxShadow: '0 8px 28px -6px rgba(0,0,0,0.18)',
      maxWidth: 380, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', cursor: 'pointer',
    }} onClick={onClose}>
      <span className="material-symbols-outlined" style={{ fontSize: 22, color: colors[item.type] }}>{icons[item.type]}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', flex: 1 }}>{item.message}</span>
    </div>
  )
}
