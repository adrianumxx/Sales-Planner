# SPEC.md — Sales Planner App

## 📋 Overview
**Sales Planner** è un'applicazione web React per pianificazione visite clienti su 90 giorni con intelligenza geografica, tracking, e export multi-formato. Ideale per PMI/team sales in Belgio.

**Caso d'uso**: Manager vendite carica CSV da Power BI → app genera piano 90 giorni automatico → team consulta, marca visite, esporta per Google Calendar.

---

## 🎯 Funzionalità MVP

### 1. Upload & Parsing CSV
- Drag-drop CSV/Excel
- Header-based parsing (case-insensitive)
- Colonne richieste: Quality, CustomerDetails, Town, DaysSinceLastVisit
- Validazione + error handling

### 2. Motore Pianificazione 90 Giorni
- **Categorizzazione urgenza**:
  - 🔴 URGENTE: >200 giorni
  - 🟡 ATTENZIONE: 130-200 giorni
  - 🟢 OK: <130 giorni
- Distribuzione intelligente su 90 giorni
- Skip automatico weekend
- Configurabile 1-15 visite/giorno
- **Garantisce**: Tutti clienti >200gg visitati entro 90 giorni

### 3. Calcolo Distanze Geografiche
- 11 città belghe con coordinate GPS
- Formula Haversine per distanze reali
- Punto partenza configurabile (default: Bruxelles)

### 4. Dashboard & Visualizzazione
- 5 KPI in tempo reale (urgenti, attenzione, OK, visite, km)
- Piano giornaliero 90 giorni
- Filtri (Tutti/Urgenti/Attenzione/OK)
- Tracking visite + note per cliente

### 5. Export Multipli
- **CSV**: Importabile Excel, metadati completi
- **iCalendar (.ics)**: Google Calendar, Outlook, Apple Calendar

### 6. Persistenza Locale
- localStorage per salvataggio automatico
- Ripristino stato su refresh

---

## 🔧 Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS 3 + CSS Variables |
| Type Safety | TypeScript strict |
| Icons | Lucide React |
| Storage | localStorage + Blob export |
| Deploy | Vercel |

---

## 📐 Architettura

```
src/
├── components/
│   ├── Dashboard.tsx         → KPI + filtri
│   ├── PlanViewer.tsx        → Visualizzazione 90gg
│   ├── SettingsPanel.tsx     → Config avanzata
│   └── FileUpload.tsx        → Drag-drop CSV
├── hooks/
│   ├── useSalesPlanner.ts    → Logica planning
│   ├── useLocalStorage.ts    → Persistenza
│   └── useFileParser.ts      → CSV parsing
├── types/
│   └── index.ts              → TypeScript types
├── utils/
│   ├── geo.ts                → Calcolo distanze
│   ├── export.ts             → CSV + iCal export
│   └── planning.ts           → Motore pianificazione
└── App.tsx                   → App principale
```

---

## 🎨 Design System

```css
Colors (Tailwind):
- Primary: indigo-600
- Success: green-600
- Warning: amber-600
- Danger: red-600
- Neutral: slate-900 (light) / slate-50 (dark)

Spacing: Tailwind default
Font: System stack (sans-serif)
Dark mode: Supportato (class-based)
```

---

## 📊 Modelli Dati

### Client
```typescript
interface Client {
  quality: number;
  customerDetails: string;
  town: string;
  daysSinceLastVisit: number;
}
```

### VisitPlan
```typescript
interface VisitPlan {
  date: string;           // YYYY-MM-DD
  visits: VisitDay[];
  totalKm: number;
}

interface VisitDay {
  id: string;
  clientName: string;
  town: string;
  distance: number;
  urgency: 'urgent' | 'attention' | 'ok';
  timeSlot: string;       // HH:MM
  completed: boolean;
  notes: string;
}
```

---

## 🚀 Deployment

**Platform**: Vercel  
**Env vars**: Nessuna (app standalone)  
**Build**: `npm run build` → dist/  
**Start**: `npm run dev`  

---

## 🔒 Security & Performance

- ✅ CSV parsing lato client (zero server)
- ✅ localStorage per privacy (no cloud)
- ✅ Type-safe TypeScript strict
- ✅ Code splitting + lazy loading
- ✅ Optimized images/icons

---

## 📱 Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

---

## ✅ Criteri Completamento

- [ ] CSV parsing con validazione
- [ ] Piano 90gg generato correttamente
- [ ] Distanze calcolate (Haversine)
- [ ] Dashboard KPI + filtri
- [ ] localStorage persistenza
- [ ] Export CSV + iCal
- [ ] Dark/light mode
- [ ] Responsive (375→1920px)
- [ ] Deploy Vercel live
- [ ] Documentazione README
