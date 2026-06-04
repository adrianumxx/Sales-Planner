import React from 'react'
import { MapPin, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface DashboardProps {
  totalVisits: number
  totalKm: number
  urgentCount: number
  attentionCount: number
}

export function Dashboard({
  totalVisits,
  totalKm,
  urgentCount,
  attentionCount,
}: DashboardProps) {
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
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
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
  )
}
