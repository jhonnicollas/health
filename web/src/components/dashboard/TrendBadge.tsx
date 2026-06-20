import './TrendBadge.css'

export type TrendDirection = 'up' | 'down' | 'stable' | 'insufficient'

type TrendBadgeProps = {
  direction: TrendDirection
  percent?: number
  invertColor?: boolean
}

export function TrendBadge({ direction, percent, invertColor = false }: TrendBadgeProps) {
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : direction === 'stable' ? '→' : '?'
  const label = direction === 'up' ? 'Naik' : direction === 'down' ? 'Turun' : direction === 'stable' ? 'Stabil' : 'Belum cukup data'
  const colorClass = invertColor
    ? (direction === 'up' ? 'bad' : direction === 'down' ? 'good' : 'neutral')
    : (direction === 'up' ? 'good' : direction === 'down' ? 'bad' : 'neutral')
  return (
    <span className={`trend-badge trend-${colorClass}`}>
      <span className="arrow">{arrow}</span>
      {label}
      {percent !== undefined && <span className="pct">{percent > 0 ? '+' : ''}{percent.toFixed(1)}%</span>}
    </span>
  )
}
export default TrendBadge
