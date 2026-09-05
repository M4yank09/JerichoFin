# Jerifin Institutional Treasury Workstation (Frontend)

Next.js 16 (Turbopack) frontend for **Jerifin** — an Institutional Capital Allocation & Treasury Risk Platform.

---

## Design System & Architecture

- **Visual Direction**: Restrained institutional financial workstation / treasury terminal.
- **Principles**:
  - Hairline structural dividers (`1px solid #E2E8F0`) over floating drop-shadowed cards.
  - Tabular numerals (`font-variant-numeric: tabular-nums`) for currency, basis points, durations, and percentages.
  - Functional risk status colors (`NORMAL`, `WARNING`, `BREACH`, `CRITICAL`).
  - First-class financial data tables with right-aligned numeric metrics.
  - Dynamic capital pool scaling (presets: ₹10 Cr, ₹50 Cr, ₹100 Cr, ₹250 Cr, ₹500 Cr, ₹1,000 Cr + custom input).
  - No generic AI gradients, neon highlights, glassmorphism, or AI dashboard clichés.

---

## Getting Started

### 1. Ensure Backend is Running
The frontend connects to the FastAPI quantitative engine on `http://127.0.0.1:8000`:
```powershell
# From project root
& "backend\.venv\Scripts\uvicorn.exe" backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Run the Frontend Development Server
```powershell
# From frontend/
corepack pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build & Verification
```powershell
# From frontend/
corepack pnpm run build
```
