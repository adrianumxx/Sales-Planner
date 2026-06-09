import React, { useEffect, useState, useMemo } from 'react'
import { Menu, Calendar, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileUpload } from './components/FileUpload'
import { Dashboard } from './components/Dashboard'
import { PlanViewer } from './components/PlanViewer'
import { SettingsPanel } from './components/SettingsPanel'
import { CalendarView } from './components/CalendarView'
import { LoginPage } from './components/LoginPage'
import { FileManager } from './components/FileManager'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EditVisitModal } from './components/EditVisitModal'
import { CommandBar } from './components/CommandBar'
import { ExportMenu } from './components/ExportMenu'
import { useSalesPlanner } from './hooks/useSalesPlanner'
import { useAuth } from './hooks/useAuth'
import { exportToCSV, exportToICalendar, exportToPDF } from './utils/export'
import { useFileParser } from './hooks/useFileParser'
import { getCityCoordinates } from './utils/geo'
import { formatDateLabel } from './utils/date'
import type { VisitDay, DailyPlan } from './types'
import type { CommandResult } from './components/CommandBar'

function App() {
  const { user, loading: authLoading, error: authError, login, logout, signup, checkEmailExists, isAuthenticated } = useAuth()
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

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
      setLoginError('Invalid credentials or connection error')
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
      setLoginError('Sign-up failed')
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

  // Authenticated content (user is guaranteed to exist here)
  return <AppContent user={user!} onLogout={handleLogout} />
}

interface AppContentProps {
  user: { id: string; email: string; user_metadata?: Record<string, any> }
  onLogout: () => Promise<void>
}

function AppContent({ user, onLogout }: AppContentProps) {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const planner = useSalesPlanner(user.id)
  const { parseFile } = useFileParser()
  const [editingVisit, setEditingVisit] = useState<{ visit: VisitDay; date: string } | null>(null)
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null)

  // Clean up old localStorage keys that might interfere
  useEffect(() => {
    localStorage.removeItem('visitsByDate')
  }, [])

  // Persistence of data, plan (incl. manual edits) and settings is owned by
  // useSalesPlanner via per-key localStorage — no save/restore wiring needed here.

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

  // Home coordinates for area-coverage routing (default Bruxelles)
  const homeCoords = useMemo(() => {
    const c = getCityCoordinates(planner.homeAddress) || getCityCoordinates('Bruxelles')
    return c ? { lat: c.lat, lon: c.lon } : { lat: 50.8503, lon: 4.3517 }
  }, [planner.homeAddress])

  const handleRemoveVisit = (date: string, visitId: string) => {
    planner.removeVisit(date, visitId)
  }

  const handleExportCSV = () => {
    exportToCSV(planner.plan)
  }

  const handleExportICal = () => {
    exportToICalendar(planner.plan)
  }

  const handleExportPDF = () => {
    exportToPDF(commandResult ? commandResult.days : filteredPlan)
  }

  // Logo click → back to the main dashboard, scrolled to top
  const goHome = () => {
    setViewMode('list')
    setSelectedDate(null)
    setCommandResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
        {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={goHome}
                className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-50 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
                title="Back to dashboard"
                aria-label="Sales Planner — back to dashboard"
              >
                📅 Sales Planner
              </button>
              <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400 mt-1">
                {user.email} • smart area coverage & optimized routes
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* File Manager */}
              <FileManager
                hasData={planner.data.length > 0}
                onUpload={async (file) => {
                  const result = await parseFile(file)
                  if (result.success && result.data) {
                    planner.loadClients(result.data)
                  }
                }}
                onClear={() => {
                  planner.clearAll()
                }}
              />

              {planner.plan.length > 0 && (
                <ExportMenu
                  onExportPDF={handleExportPDF}
                  onExportCSV={handleExportCSV}
                  onExportICal={handleExportICal}
                />
              )}

              <button
                onClick={() => planner.setShowSettings(!planner.showSettings)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <Menu className="h-5 w-5 sm:h-6 sm:w-6 text-slate-900 dark:text-slate-50" />
              </button>

              <button
                onClick={onLogout}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="h-5 w-5 sm:h-6 sm:w-6 text-slate-900 dark:text-slate-50" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-8">
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
                planDays={planner.plan.length}
                dateRangeLabel={
                  planner.plan.length > 0
                    ? `${formatDateLabel(planner.plan[0].date, { month: 'short', day: 'numeric' })} – ${formatDateLabel(planner.plan[planner.plan.length - 1].date, { month: 'short', day: 'numeric' })}`
                    : ''
                }
              />

              {/* Command Bar */}
              {viewMode === 'list' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <CommandBar
                    plan={planner.plan}
                    clients={planner.data}
                    homeCoords={homeCoords}
                    visitsPerDay={planner.visitsPerDay}
                    maxKmPerDay={planner.maxKmPerDay}
                    onResult={setCommandResult}
                  />
                </motion.div>
              )}

              {/* Command result banner */}
              <AnimatePresence>
                {commandResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border ${
                      commandResult.type === 'area'
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                        : 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    <span className="font-semibold">
                      {commandResult.type === 'area' ? '📍' : '✨'} {commandResult.totalVisits} visits
                    </span>
                    <span className="opacity-70">
                      {commandResult.description ?? `for "${commandResult.label}"`}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* View Mode Toggle */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex gap-2 sm:gap-3 items-center justify-between"
              >
                <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-50">
                  {viewMode === 'list' ? 'Coverage Plan' : 'Calendar View'}
                </h2>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setViewMode('list')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg font-semibold transition-all ${
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
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg font-semibold transition-all flex items-center gap-1 sm:gap-2 ${
                      viewMode === 'calendar'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-50'
                    }`}
                  >
                    <Calendar className="h-4 w-4" /> Calendar
                  </motion.button>
                </div>
              </motion.div>

              {/* Horizon selector — how many weeks before the rest goes to Backlog */}
              {viewMode === 'list' && !commandResult && planner.plan.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Show:</span>
                  {([['2 weeks', 2], ['4 weeks', 4], ['All', 0]] as const).map(([label, val]) => (
                    <button
                      key={label}
                      onClick={() => planner.setPlanHorizonWeeks(val)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        planner.planHorizonWeeks === val
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Plan Viewer - List Mode */}
              {viewMode === 'list' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <PlanViewer
                    plan={commandResult ? commandResult.days : filteredPlan}
                    completedVisits={planner.completedVisits}
                    notes={planner.notes}
                    voiceNotes={planner.voiceNotes}
                    onToggleComplete={planner.toggleComplete}
                    onUpdateNote={planner.updateNote}
                    onSaveVoiceNote={planner.saveVoiceNote}
                    editable={!commandResult}
                    horizonWeeks={commandResult ? 0 : planner.planHorizonWeeks}
                    evRangeKm={planner.vehicleType === 'electric' ? planner.evRangeKm : 0}
                    onEditVisit={(visit, date) => setEditingVisit({ visit, date })}
                    onMoveVisit={(visit, fromDate, toDate) => planner.moveVisit(fromDate, toDate, visit.id)}
                    onReorderVisit={planner.reorderVisit}
                    onReoptimizeDay={planner.reoptimizeDay}
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
                    visitsPerDay={planner.visitsPerDay}
                    adminDays={planner.adminDays}
                    onToggleAdminDay={planner.toggleAdminDay}
                    onRemoveVisit={handleRemoveVisit}
                    onVisitClick={(visit, date) => setEditingVisit({ visit, date })}
                    onMoveVisit={(visit, fromDate, toDate) => {
                      planner.moveVisit(fromDate, toDate, visit.id)
                    }}
                    onReorderVisit={planner.reorderVisit}
                    onUpdateVisit={(visit) => {
                      if (editingVisit) {
                        planner.updateVisit(editingVisit.date, visit)
                      }
                    }}
                  />
                </motion.div>
              )}

            </>
          )}
        </div>
      </main>

      {/* Settings Panel */}
      {planner.showSettings && (
        <SettingsPanel
          homeAddress={planner.homeAddress}
          returnAddress={planner.returnAddress}
          visitsPerDay={planner.visitsPerDay}
          maxKmPerDay={planner.maxKmPerDay}
          vehicleType={planner.vehicleType}
          evRangeKm={planner.evRangeKm}
          carModel={planner.carModel}
          darkMode={planner.darkMode}
          onHomeAddressChange={planner.setHomeAddress}
          onReturnAddressChange={planner.setReturnAddress}
          onVisitsPerDayChange={planner.setVisitsPerDay}
          onMaxKmPerDayChange={planner.setMaxKmPerDay}
          onVehicleTypeChange={planner.setVehicleType}
          onEvRangeChange={planner.setEvRangeKm}
          onCarModelChange={planner.setCarModel}
          onDarkModeChange={planner.setDarkMode}
          onClearAll={planner.clearAll}
          onClose={() => planner.setShowSettings(false)}
          onRegenerate={planner.regeneratePlan}
        />
      )}

      {/* Edit Visit Modal */}
      {editingVisit && (
        <EditVisitModal
          visit={editingVisit.visit}
          isOpen={true}
          onClose={() => setEditingVisit(null)}
          onSave={(updatedVisit) => {
            planner.updateVisit(editingVisit.date, updatedVisit)
            setEditingVisit(null)
          }}
        />
      )}
      </div>
    </ErrorBoundary>
  )
}

export default App
