# REVIEW.md — Sales Planner App

## Code Review Checklist

### Performance
- [ ] No hardcoded hex colors → use CSS variables
- [ ] No magic numbers → use spacing vars (s2, s4, s6, etc)
- [ ] Component lazy loading + code splitting
- [ ] Image optimization + WebP
- [ ] localStorage vs state management

### Type Safety (TypeScript)
- [ ] No `any` type
- [ ] All function params typed
- [ ] All returns typed
- [ ] Strict mode enabled

### Code Quality
- [ ] No console.log left in production
- [ ] No commented code
- [ ] Single responsibility principle
- [ ] DRY (Don't Repeat Yourself)
- [ ] Meaningful variable names

### Accessibility (a11y)
- [ ] ARIA labels on buttons/inputs
- [ ] Keyboard navigation (Tab, Enter)
- [ ] Color contrast >= 4.5:1
- [ ] Focus indicators visible
- [ ] Alt text on images

### Responsive Design
- [ ] Mobile first (375px base)
- [ ] Tablet breakpoint (768px)
- [ ] Desktop (1024px+)
- [ ] No horizontal overflow
- [ ] Touch targets >= 44px

### Testing
- [ ] CSV parsing (valid + invalid)
- [ ] Plan generation (urgency logic)
- [ ] Distance calculation (Haversine)
- [ ] Export CSV format
- [ ] Export iCalendar RFC 5545
- [ ] localStorage persistence
- [ ] Dark/light mode toggle

### Security
- [ ] No XSS vulnerabilities
- [ ] CSV injection protection
- [ ] Safe file upload (type validation)
- [ ] CSP headers (if applicable)
- [ ] No sensitive data in localStorage

### Documentation
- [ ] README.md with setup instructions
- [ ] Code comments (WHY, not WHAT)
- [ ] Inline function docs (JSDoc)
- [ ] API documentation
- [ ] Example CSV file

---

## Review by Phase

### FASE 1: Setup
**Reviewer**: Architects  
**Checklist**: TypeScript config, Tailwind setup, folder structure  

### FASE 2: Logic
**Reviewer**: Backend Engineer  
**Checklist**: Algorithm correctness, edge cases, performance  

### FASE 3: UI
**Reviewer**: Frontend Designer  
**Checklist**: Responsiveness, accessibility, dark mode  

### FASE 4: Integration
**Reviewer**: QA  
**Checklist**: E2E testing, cross-browser  

### FASE 5: Deploy
**Reviewer**: DevOps  
**Checklist**: Build optimization, caching, analytics  

---

## Testing Checklist

### Unit Tests
- [ ] `useSalesPlanner` hook
- [ ] `useFileParser` CSV validation
- [ ] Haversine distance calculation
- [ ] Export functions (CSV, iCal)

### Integration Tests
- [ ] Upload CSV → Generate plan → Export
- [ ] Settings change → Plan regenerate
- [ ] localStorage persist → refresh → restore

### E2E Tests
- [ ] Full user flow (upload → filter → export)
- [ ] Dark mode persistence
- [ ] Responsive on mobile/tablet/desktop

---

## Metrics

| Metric | Target |
|--------|--------|
| Bundle size | < 200KB |
| Lighthouse | >= 90 |
| Time to interactive | < 2s |
| Accessibility | >= 95 |

