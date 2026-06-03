import React, { useEffect } from 'react'
import { Menu, Download, FileDown } from 'lucide-react'
import { FileUpload } from './components/FileUpload'
import { Dashboard } from './components/Dashboard'
import { PlanViewer } from './components/PlanViewer'
import { SettingsPanel } from './components/SettingsPanel'
import { useSalesPlanner } from './hooks/useSalesPlanner'
import { useLocalStorage } from './hooks/useLocalStorage'
import { exportToCSV, exportToICalendar } from './utils/export'
import { getCityCoordinates } from './utils/geo'

function App() {
  const [savedState, setSavedState] = useLocalStorage('salesPlannerState', null as any)
  const planner = useSalesPlanner()

  // Load saved state on mount
  useEffect(() => {
    if (savedState) {
      if (savedState.data?.length > 0) {
        planner.loadClients(savedState.data)
        planner.setFilter(savedState.filter || 'all')
        planner.setHomeAddress(savedState.homeAddress || 'Bruxelles')
        planner.setVisitsPerDay(savedState.visitsPerDay || 7)
        planner.setDarkMode(savedState.darkMode || false)
      }
    }
  }, [])

  // Save state to localStorage on changes
  useEffect(() => {
    setSavedState({
      data: planner.data,
      filter: planner.filter,
      homeAddress: planner.homeAddress,
      visitsPerDay: planner.visitsPerDay,
      darkMode: planner.darkMode,
      completedVisits: Array.from(planner.completedVisits),
      notes: planner.notes,
    })
  }, [planner.data, planner.filter, planner.homeAddress, planner.visitsPerDay, planner.darkMode, planner.completedVisits, planner.notes])

  // Apply dark mode to document
  useEffect(() => {
    if (planner.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [planner.darkMode])

  const metrics = planner.getTotalMetrics()
  const filteredPlan = planner.getFilteredPlan()

  const handleExportCSV = () => {
    exportToCSV(planner.plan)
  }

  const handleExportICal = () => {
    exportToICalendar(planner.plan)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">📅 Sales Planner</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">90-day sales visit planner with geographic intelligence</p>
            </div>

            <div className="flex items-center gap-3">
              {planner.plan.length > 0 && (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-50 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition text-sm"
                  >
                    <FileDown className="h-4 w-4" />
                    CSV
                  </button>
                  <button
                    onClick={handleExportICal}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-50 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition text-sm"
                  >
                    <Download className="h-4 w-4" />
                    iCal
                  </button>
                </div>
              )}

              <button
                onClick={() => planner.setShowSettings(!planner.showSettings)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <Menu className="h-6 w-6 text-slate-900 dark:text-slate-50" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Upload Section */}
          {planner.data.length === 0 ? (
            <FileUpload onUpload={planner.loadClients} />
          ) : (
            <>
              {/* Dashboard */}
              <Dashboard
                totalVisits={metrics.totalVisits}
                totalKm={metrics.totalKm}
                urgentCount={metrics.urgentCount}
                attentionCount={metrics.attentionCount}
                filter={planner.filter}
                onFilterChange={planner.setFilter}
              />

              {/* Plan Viewer */}
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">
                  90-Day Plan
                </h2>
                <PlanViewer
                  plan={filteredPlan}
                  completedVisits={planner.completedVisits}
                  notes={planner.notes}
                  onToggleComplete={planner.toggleComplete}
                  onUpdateNote={planner.updateNote}
                />
              </div>

              {/* Upload Another File */}
              <button
                onClick={() => {
                  planner.data.length = 0 // Clear data
                  window.location.reload()
                }}
                className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-600 dark:hover:border-indigo-400 transition"
              >
                Upload Another File
              </button>
            </>
          )}
        </div>
      </main>

      {/* Settings Panel */}
      {planner.showSettings && (
        <SettingsPanel
          homeAddress={planner.homeAddress}
          visitsPerDay={planner.visitsPerDay}
          darkMode={planner.darkMode}
          onHomeAddressChange={planner.setHomeAddress}
          onVisitsPerDayChange={planner.setVisitsPerDay}
          onDarkModeChange={planner.setDarkMode}
          onClose={() => planner.setShowSettings(false)}
          onRegenerate={planner.regeneratePlan}
        />
      )}
    </div>
  )
}

export default App
