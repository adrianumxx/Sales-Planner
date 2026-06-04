import React, { useEffect, useState, useMemo } from 'react'
import { Menu, Download, FileDown, Calendar, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { FileUpload } from './components/FileUpload'
import { Dashboard } from './components/Dashboard'
import { PlanViewer } from './components/PlanViewer'
import { SettingsPanel } from './components/SettingsPanel'
import { CalendarView } from './components/CalendarView'
import { LoginPage } from './components/LoginPage'
import { FileManager } from './components/FileManager'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSalesPlanner } from './hooks/useSalesPlanner'
import { useAuth } from './hooks/useAuth'
import { useLocalStorage } from './hooks/useLocalStorage'
import { exportToCSV, exportToICalendar } from './utils/export'
import { getCityCoordinates } from './utils/geo'
import type { VisitDay } from './types'

function App() {
  const { user, loading: authLoading, error: authError, login, logout, signup, checkEmailExists, isAuthenticated } = useAuth()
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [savedState, setSavedState] = useLocalStorage('salesPlannerState', null as any)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visitsByDate, setVisitsByDate] = useLocalStorage('visitsByDate', {} as Record<string, VisitDay[]>)
  const planner = useSalesPlanner()

  // Handle email check
  const handleCheckEmail = async (email: string) => {
    return await checkEmailExists(email)
  }

  // Handle login
  const handleLogin = async (email: string, password: string) => {
    setLoginLoading(true)
    setLoginError(null)
    const success = await login(email, password)
    setLoginLoading(false)
    if (!success) {
      setLoginError('Credenziali non valide o errore di connessione')
    }
    return success
  }

  // Handle signup
  const handleSignup = async (email: string, password: string) => {
    setLoginLoading(true)
    setLoginError(null)
    const success = await signup(email, password)
    setLoginLoading(false)
    if (!success) {
      setLoginError('Errore durante la registrazione')
    }
    return success
  }

  // Handle logout
  const handleLogout = async () => {
    await logout()
  }

  // Show login page if not authenticated
  if (!isAuthenticated && !authLoading) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onSignup={handleSignup}
        onCheckEmail={handleCheckEmail}
        loading={loginLoading}
        error={loginError || authError}
      />
    )
  }

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
          <div className="w-12 h-12 border-3 border-indigo-500 border-t-cyan-500 rounded-full" />
        </motion.div>
      </div>
    )
  }

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
  }, [planner.data, planner.filter, planner.homeAddress, planner.visitsPerDay, planner.darkMode, planner.completedVisits, planner.notes, setSavedState])

  // Apply dark mode to document
  useEffect(() => {
    if (planner.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [planner.darkMode])

  // Build visitsByDate map from plan
  const visitsByDateMap = useMemo(() => {
    const map: Record<string, VisitDay[]> = {}
    planner.plan.forEach(day => {
      map[day.date] = day.visits
    })
    return map
  }, [planner.plan])

  const metrics = planner.getTotalMetrics()
  const filteredPlan = planner.getFilteredPlan()

  const handleRemoveVisit = (date: string, visitId: string) => {
    const updated = planner.plan.map(day => {
      if (day.date === date) {
        return {
          ...day,
          visits: day.visits.filter(v => v.id !== visitId),
        }
      }
      return day
    })
    // Update plan (would need to expose setPlan in useSalesPlanner)
  }

  const handleExportCSV = () => {
    exportToCSV(planner.plan)
  }

  const handleExportICal = () => {
    exportToICalendar(planner.plan)
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
        {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">📅 Sales Planner</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {user?.email} • 90-day sales visit planner
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* File Manager */}
              <FileManager
                hasData={planner.data.length > 0}
                onUpload={(file) => {
                  const reader = new FileReader()
                  reader.onload = async (e) => {
                    const text = e.target?.result as string
                    // Parse CSV and load
                    try {
                      const lines = text.split('\n').filter(l => l.trim())
                      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
                      const clients = lines.slice(1).map(line => {
                        const values = line.split(',').map(v => v.trim())
                        const urgencyRaw = (values[headers.indexOf('urgency status')] || 'ok').toLowerCase()
                        let urgency: 'urgent' | 'attention' | 'ok' = 'ok'
                        if (urgencyRaw === 'urgent') urgency = 'urgent'
                        else if (urgencyRaw === 'attention') urgency = 'attention'

                        return {
                          id: Math.random().toString(36).substr(2, 9),
                          clientName: values[headers.indexOf('client name')] || '',
                          town: values[headers.indexOf('town')] || '',
                          lastVisitDays: parseInt(values[headers.indexOf('last visit (days)')] || '0'),
                          urgency,
                        }
                      }).filter(c => c.clientName)
                      if (clients.length > 0) {
                        planner.loadClients(clients)
                      }
                    } catch (err) {
                      console.error('CSV parse error:', err)
                    }
                  }
                  reader.readAsText(file)
                }}
                onClear={() => {
                  planner.data.length = 0
                  window.location.reload()
                }}
              />

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

              <button
                onClick={handleLogout}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="h-6 w-6 text-slate-900 dark:text-slate-50" />
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

              {/* View Mode Toggle */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex gap-3 items-center justify-between"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                  {viewMode === 'list' ? '90-Day Plan' : 'Calendar View'}
                </h2>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      viewMode === 'list'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-50'
                    }`}
                  >
                    📋 List
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setViewMode('calendar')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                      viewMode === 'calendar'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-50'
                    }`}
                  >
                    <Calendar className="h-4 w-4" /> Calendar
                  </motion.button>
                </div>
              </motion.div>

              {/* Plan Viewer - List Mode */}
              {viewMode === 'list' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <PlanViewer
                    plan={filteredPlan}
                    completedVisits={planner.completedVisits}
                    notes={planner.notes}
                    visitTimerStates={planner.visitTimerStates}
                    visitElapsedTimes={planner.visitElapsedTimes}
                    visitStartTimes={planner.visitStartTimes}
                    visitPausedTimes={planner.visitPausedTimes}
                    onToggleComplete={planner.toggleComplete}
                    onUpdateNote={planner.updateNote}
                    onUpdateTimerState={planner.updateTimerState}
                  />
                </motion.div>
              )}

              {/* Calendar View - Calendar Mode */}
              {viewMode === 'calendar' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <CalendarView
                    plan={planner.plan}
                    onDateSelect={setSelectedDate}
                    selectedDate={selectedDate}
                    visitsByDate={visitsByDateMap}
                    onRemoveVisit={handleRemoveVisit}
                  />
                </motion.div>
              )}

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
    </ErrorBoundary>
  )
}

export default App
