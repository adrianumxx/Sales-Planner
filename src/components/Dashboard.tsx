import React from 'react'
import { TrendingUp, MapPin, CheckCircle2, AlertCircle } from 'lucide-react'

interface DashboardProps {
  totalVisits: number
  totalKm: number
  urgentCount: number
  attentionCount: number
  filter: string
  onFilterChange: (filter: 'all' | 'urgent' | 'attention' | 'ok') => void
}

export function Dashboard({
  totalVisits,
  totalKm,
  urgentCount,
  attentionCount,
  filter,
  onFilterChange,
}: DashboardProps) {
  const okCount = totalVisits - urgentCount - attentionCount

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Visits"
          value={totalVisits}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-50"
        />
        <KPICard
          label="Total Distance"
          value={`${totalKm} km`}
          icon={<MapPin className="h-5 w-5" />}
          color="bg-purple-50 dark:bg-purple-900 text-purple-900 dark:text-purple-50"
        />
        <KPICard
          label="Urgent"
          value={urgentCount}
          icon={<AlertCircle className="h-5 w-5" />}
          color="bg-red-50 dark:bg-red-900 text-red-900 dark:text-red-50"
        />
        <KPICard
          label="Attention"
          value={attentionCount}
          icon={<AlertCircle className="h-5 w-5" />}
          color="bg-amber-50 dark:bg-amber-900 text-amber-900 dark:text-amber-50"
        />
        <KPICard
          label="On Track"
          value={okCount}
          icon={<TrendingUp className="h-5 w-5" />}
          color="bg-green-50 dark:bg-green-900 text-green-900 dark:text-green-50"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-4">Filter by Urgency</h3>
        <div className="flex flex-wrap gap-2">
          {(['all', 'urgent', 'attention', 'ok'] as const).map(f => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-50 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {f === 'all' ? 'All' : f === 'urgent' ? '🔴 Urgent' : f === 'attention' ? '🟡 Attention' : '🟢 On Track'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function KPICard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className={`${color} rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium opacity-75">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className="opacity-30">{icon}</div>
      </div>
    </div>
  )
}
