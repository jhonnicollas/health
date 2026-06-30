import type { TabId } from '../../pages/admin/types'

interface AdminSidebarProps {
  tabs: { id: TabId; label: string }[]
  active: TabId
  onChange: (id: TabId) => void
}

export function AdminSidebar({ tabs, active, onChange }: AdminSidebarProps) {
  return (
    <nav className="admin-tabs">
      {tabs.map(tb => (
        <button key={tb.id} className={active === tb.id ? 'active' : ''} onClick={() => onChange(tb.id)}>
          {tb.label}
        </button>
      ))}
    </nav>
  )
}
