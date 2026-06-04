import React from 'react'
import { TrendingUp, MapPin, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  }

  const kpiCards = [
    {
      label: 'Total Visits',
      value: totalVisits,
      icon: <CheckCircle2 className="h-6 w-6" />,
      gradient: 'from-blue-500/20 to-blue-600/20 dark:from-blue-500/10 dark:to-blue-600/10',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-900 dark:text-blue-100',
    },
    {
      label: 'Total Distance',
      value: `${totalKm} km`,
      icon: <MapPin className="h-6 w-6" />,
      gradient: 'from-purple-500/20 to-purple-600/20 dark:from-purple-500/10 dark:to-purple-600/10',
      borderColor: 'border-purple-200 dark:border-purple-800',
      textColor: 'text-purple-900 dark:text-purple-100',
    },
    {
      label: 'Urgent',
      value: urgentCount,
      icon: <AlertCircle className="h-6 w-6" />,
      gradient: 'from-red-500/20 to-red-600/20 dark:from-red-500/10 dark:to-red-600/10',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-900 dark:text-red-100',
    },
    {
      label: 'Attention',
      value: attentionCount,
      icon: <AlertCircle className="h-6 w-6" />,
      gradient: 'from-amber-500/20 to-amber-600/20 dark:from-amber-500/10 dark:to-amber-600/10',
      borderColor: 'border-amber-200 dark:border-amber-800',
      textColor: 'text-amber-900 dark:text-amber-100',
    },
    {
      label: 'On Track',
      value: okCount,
      icon: <TrendingUp className="h-6 w-6" />,
      gradient: 'from-green-500/20 to-green-600/20 dark:from-green-500/10 dark:to-green-600/10',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-900 dark:text-green-100',
    },
  ]

  return (
    <div className="space-y-8">
      {/* KPI Cards Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
      >
        {kpiCards.map((card, idx) => (
          <motion.div
            key={card.label}
            variants={itemVariants}
            whileHover={{ y: -4, scale: 1.02 }}
            className={`bg-gradient-to-br ${card.gradient} border ${card.borderColor} rounded-2xl p-3 sm:p-6 backdrop-blur-sm cursor-default transition-all duration-300 hover:shadow-lg hover:shadow-slate-400/10 dark:hover:shadow-slate-900/20`}
          >
            <motion.div
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ delay: 0.1 * idx + 0.2, type: 'spring' }}
              className={`inline-flex p-1 sm:p-2 rounded-lg ${card.textColor} mb-2 sm:mb-4 opacity-60`}
            >
              {card.icon}
            </motion.div>

            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 sm:mb-2 leading-tight">
              {card.label}
            </p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 * idx + 0.3 }}
              className={`text-xl sm:text-3xl font-bold ${card.textColor}`}
            >
              {card.value}
            </motion.p>
          </motion.div>
        ))}
      </motion.div>

      {/* Filter Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-r from-slate-50/50 to-slate-100/50 dark:from-slate-800/30 dark:to-slate-900/30 rounded-2xl p-4 sm:p-6 backdrop-blur-sm border border-slate-200 dark:border-slate-700"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4" /> Filter by Urgency
        </h3>

        <div className="flex flex-wrap gap-3">
          {(
            [
              { key: 'all', label: 'All Visits', emoji: '🎯' },
              { key: 'urgent', label: '🔴 Urgent', emoji: '⚡' },
              { key: 'attention', label: '🟡 Attention', emoji: '⚠️' },
              { key: 'ok', label: '🟢 On Track', emoji: '✅' },
            ] as const
          ).map((f) => (
            <motion.button
              key={f.key}
              onClick={() => onFilterChange(f.key as any)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 ${
                filter === f.key
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-500 dark:to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
              }`}
            >
              {f.emoji} {f.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
