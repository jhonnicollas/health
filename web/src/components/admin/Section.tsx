import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="admin-section">
      <h3>{title}</h3>
      {children}
    </div>
  )
}
