import React from 'react'
import { X, Settings } from 'lucide-react'
import { cityCoordinates } from '../utils/geo'

interface SettingsPanelProps {
  homeAddress: string
  visitsPerDay: number
  darkMode: boolean
  onHomeAddressChange: (address: string) => void
  onVisitsPerDayChange: (count: number) => void
  onDarkModeChange: (enabled: boolean) => void
  onClose: () => void
  onRegenerate: () => void
}

export function SettingsPanel({
  homeAddress,
  visitsPerDay,
  darkMode,
  onHomeAddressChange,
  onVisitsPerDayChange,
  onDarkModeChange,
  onClose,
  onRegenerate,
}: SettingsPanelProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2">
              Home Location
            </label>
            <select
              value={homeAddress}
              onChange={(e) => onHomeAddressChange(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {cityCoordinates.map(city => (
                <option key={city.city} value={city.city}>
                  {city.city}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Starting point for distance calculations
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2">
              Max Visits per Day
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="15"
                value={visitsPerDay}
                onChange={(e) => onVisitsPerDayChange(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 min-w-12 text-center">
                {visitsPerDay}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Adjust planning intensity (1-15 visits/day)
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <label className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Dark Mode
            </label>
            <button
              onClick={() => onDarkModeChange(!darkMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                darkMode ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <button
            onClick={() => {
              onRegenerate()
              onClose()
            }}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            Regenerate Plan
          </button>
        </div>
      </div>
    </div>
  )
}
