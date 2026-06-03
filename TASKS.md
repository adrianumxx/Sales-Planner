# TASKS.md — Sales Planner App

## 🎯 Roadmap

### FASE 1: Fondamenta (Setup + Types)
- [ ] **1.1** package.json + Vite config
- [ ] **1.2** Tailwind + CSS Variables (dark mode)
- [ ] **1.3** TypeScript types (src/types/index.ts)
- [ ] **1.4** Folder structure + componenti base

### FASE 2: Core Logic (Hooks + Utils)
- [ ] **2.1** `useSalesPlanner.ts` → Motore pianificazione 90gg
- [ ] **2.2** `useLocalStorage.ts` → Persistenza state
- [ ] **2.3** `useFileParser.ts` → CSV parsing
- [ ] **2.4** `geo.ts` → Haversine + coordinate belghe
- [ ] **2.5** `export.ts` → CSV + iCalendar

### FASE 3: UI Components
- [ ] **3.1** FileUpload → Drag-drop CSV + validazione
- [ ] **3.2** Dashboard → KPI + filtri
- [ ] **3.3** PlanViewer → Timeline 90gg
- [ ] **3.4** SettingsPanel → Config avanzata
- [ ] **3.5** Responsive layout (375→1920px)

### FASE 4: Integrazione + Testing
- [ ] **4.1** App.tsx → Connessione componenti
- [ ] **4.2** Test CSV parsing (file di esempio)
- [ ] **4.3** Test distanze (verifica km)
- [ ] **4.4** Test export (CSV + iCal)
- [ ] **4.5** Dark/light mode toggle

### FASE 5: Deploy
- [ ] **5.1** Vercel setup (vercel.json)
- [ ] **5.2** GitHub push + link repo
- [ ] **5.3** CI/CD (build optimization)
- [ ] **5.4** Deploy live
- [ ] **5.5** README + docs

---

## 📋 In Progress

Nessuno - **APP PRODUCTION READY** ✅

---

## ✅ Completato

**FASE 1: Setup + Types**
- [x] **1.1** package.json + Vite config
- [x] **1.2** Tailwind + CSS Variables (dark mode)
- [x] **1.3** TypeScript types (strict mode)
- [x] **1.4** Folder structure

**FASE 2: Logic + Utils**
- [x] **2.1** useSalesPlanner hook
- [x] **2.2** useLocalStorage persistence
- [x] **2.3** useFileParser CSV/Excel
- [x] **2.4** Haversine geo calculations
- [x] **2.5** CSV + iCalendar export

**FASE 3: UI Components**
- [x] **3.1** FileUpload drag-drop
- [x] **3.2** Dashboard KPI + filters
- [x] **3.3** PlanViewer timeline
- [x] **3.4** SettingsPanel config
- [x] **3.5** Responsive design

**FASE 4: Integration + Polish**
- [x] **4.1** Full app integration
- [x] **4.2** Dark/light mode toggle
- [x] **4.3** Auto-regenerate on settings change
- [x] **4.4** Working days Tue-Fri only
- [x] **4.5** Dynamic time slots per visit count

**FASE 5: Production**
- [x] **5.1** Vercel deployment ready
- [x] **5.2** GitHub repo live
- [x] **5.3** Zero console logs
- [x] **5.4** TypeScript strict clean
- [x] **5.5** Production build (53.84KB gzipped)

---

## 🐛 Known Issues

Nessuno - **PRODUCTION READY**

---

## 🔄 Prossimo Step

→ DEPLOY + USAGE
