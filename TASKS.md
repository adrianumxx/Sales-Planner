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

**Corrente**: Fase 1.1 — package.json setup

---

## ✅ Completato

---

## 🐛 Known Issues

- Nessuno al momento (progetto in creazione)

---

## 🔄 Prossimo Step

→ Fase 1.1: Setup Vite + package.json
