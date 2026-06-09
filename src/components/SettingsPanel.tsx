import React, { useState } from 'react'
import { X, Settings, Sun, Moon, Sliders, RotateCcw, Car, BatteryCharging } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MAJOR_CITIES } from '../utils/geo'

interface SettingsPanelProps {
  homeAddress: string
  visitsPerDay: number
  maxKmPerDay: number
  vehicleType: 'combustion' | 'electric'
  evRangeKm: number
  carModel: string
  darkMode: boolean
  onHomeAddressChange: (address: string) => void
  onVisitsPerDayChange: (count: number) => void
  onMaxKmPerDayChange: (km: number) => void
  onVehicleTypeChange: (t: 'combustion' | 'electric') => void
  onEvRangeChange: (km: number) => void
  onCarModelChange: (m: string) => void
  onDarkModeChange: (enabled: boolean) => void
  onClose: () => void
  onRegenerate: () => void
}

const MAX_KM_PRESETS = [0, 100, 150, 200, 250]

export function SettingsPanel({
  homeAddress,
  visitsPerDay,
  maxKmPerDay,
  vehicleType,
  evRangeKm,
  carModel,
  darkMode,
  onHomeAddressChange,
  onVisitsPerDayChange,
  onMaxKmPerDayChange,
  onVehicleTypeChange,
  onEvRangeChange,
  onCarModelChange,
  onDarkModeChange,
  onClose,
}: SettingsPanelProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  const backdropVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  }

  const panelVariants = {
    initial: {
      opacity: 0,
      scale: 0.95,
      y: 20,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 20,
    },
  }

  const sectionVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      >
        <motion.div
          variants={panelVariants}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto relative"
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 bg-gradient-to-r from-white/80 to-slate-50/80 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-sm"
          >
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-50 dark:to-slate-200 bg-clip-text text-transparent flex items-center gap-3"
            >
              <Settings className="h-6 w-6 text-indigo-600 dark:text-cyan-400" />
              Settings
            </motion.h2>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <X className="h-6 w-6" />
            </motion.button>
          </motion.div>

          <div className="p-6 space-y-8">
            {/* Home Location */}
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.2 }}
            >
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-50 mb-3 flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-indigo-600 dark:text-cyan-400" />
                Home Location
              </label>
              <input
                type="text"
                list="major-cities"
                value={homeAddress}
                onChange={(e) => onHomeAddressChange(e.target.value)}
                placeholder="e.g. Charleroi, Mons, La Louvière…"
                className="w-full px-4 py-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium"
              />
              <datalist id="major-cities">
                {MAJOR_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                📍 Starting point for distance and route calculations
              </p>
            </motion.div>

            {/* Max Visits per Day */}
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-50 mb-3 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Max Visits per Day
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={visitsPerDay}
                  onChange={(e) => onVisitsPerDayChange(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  style={{
                    background: `linear-gradient(to right, #6366F1 0%, #A855F7 ${(visitsPerDay / 15) * 100}%, #E5E7EB ${(visitsPerDay / 15) * 100}%, #E5E7EB 100%)`
                  }}
                />
                <motion.span
                  key={visitsPerDay}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-2xl font-bold text-indigo-600 dark:text-cyan-400 min-w-12 text-center bg-indigo-50 dark:bg-indigo-900/20 rounded-lg py-2"
                >
                  {visitsPerDay}
                </motion.span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                <span>Light schedule</span>
                <span>Heavy schedule</span>
              </div>
            </motion.div>

            {/* Max km per day */}
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.35 }}
            >
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-50 mb-3 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Max driving per day
              </label>
              <div className="flex flex-wrap gap-2">
                {MAX_KM_PRESETS.map((km) => (
                  <button
                    key={km}
                    onClick={() => onMaxKmPerDayChange(km)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      maxKmPerDay === km
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                    }`}
                  >
                    {km === 0 ? 'No cap' : `${km} km`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                🚗 Caps each day's round-trip driving for realistic days. A single far client is never dropped.
              </p>
            </motion.div>

            {/* Vehicle */}
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.4 }}
            >
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-50 mb-3 flex items-center gap-2">
                <Car className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                Vehicle
              </label>
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-700/50 p-1 gap-1">
                {(['combustion', 'electric'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onVehicleTypeChange(t)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                      vehicleType === t
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {t === 'electric' ? <BatteryCharging className="h-4 w-4" /> : <Car className="h-4 w-4" />}
                    {t === 'electric' ? 'Electric' : 'Combustion'}
                  </button>
                ))}
              </div>

              <AnimatePresence initial={false}>
                {vehicleType === 'electric' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                          Starting range (km)
                        </label>
                        <input
                          type="number"
                          min={50}
                          max={1000}
                          step={10}
                          value={evRangeKm}
                          onChange={(e) => onEvRangeChange(parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                          Car model (optional)
                        </label>
                        <input
                          type="text"
                          value={carModel}
                          onChange={(e) => onCarModelChange(e.target.value)}
                          placeholder="e.g. Tesla Model 3, VW ID.4…"
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ⚡ When a day's route nears your range, the plan suggests a charging stop near the right meeting.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Dark Mode Toggle */}
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.4 }}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600"
            >
              <div className="flex items-center gap-3">
                {darkMode ? (
                  <Moon className="h-5 w-5 text-indigo-600" />
                ) : (
                  <Sun className="h-5 w-5 text-amber-500" />
                )}
                <label className="text-sm font-bold text-slate-900 dark:text-slate-50 cursor-pointer">
                  Dark Mode
                </label>
              </div>
              <motion.button
                onClick={() => onDarkModeChange(!darkMode)}
                whileTap={{ scale: 0.9 }}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ${
                  darkMode
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                    : 'bg-gradient-to-r from-slate-300 to-slate-400'
                }`}
              >
                <motion.span
                  layout
                  className="inline-block h-6 w-6 transform rounded-full bg-white shadow-lg"
                  animate={{
                    x: darkMode ? 28 : 2,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </motion.div>

            {/* Regenerate Button */}
            <motion.button
              variants={sectionVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.5 }}
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-500 dark:to-purple-600 text-white font-bold py-3 rounded-2xl hover:shadow-xl hover:shadow-indigo-500/50 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-5 w-5" />
              Save & Close
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M4.25 2A2.25 2.25 0 002 4.25v11.5A2.25 2.25 0 004.25 18h11.5A2.25 2.25 0 0018 15.75V4.25A2.25 2.25 0 0015.75 2H4.25zm0 1.5h11.5a.75.75 0 01.75.75v11.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75V4.25a.75.75 0 01.75-.75z"
        clipRule="evenodd"
      />
    </svg>
  )
}
