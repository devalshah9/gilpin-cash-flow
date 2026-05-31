# Gilpin Cash Flow

A small React + Vite app for modeling rental cash flow and investment returns.

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start development server

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### 3. Build for production

```bash
npm run build
```

## Project structure

- `src/App.jsx` — main app component
- `src/main.jsx` — React entry point
- `src/index.css` — Tailwind base styles
- `vite.config.js` — Vite configuration
- `tailwind.config.js` — Tailwind CSS configuration
- `postcss.config.js` — PostCSS configuration

## Usage guide

- `Starting monthly rent` — the current rent received from the property.
- `Annual rent growth` — the yearly rent increase assumed for the holding period.
- `Vacancy allowance` — the percentage of rent lost to vacancy.
- `Total vacancy months` — the total number of months without rent over the holding period. If set, this overrides the vacancy allowance rate for cash flow calculations.
- `Monthly HOA`, `Monthly property tax`, and `Monthly insurance` — recurring operating costs.
- `Monthly repairs`, `Monthly CapEx`, and `Property management` — actual monthly expense inputs for repairs and capital expenditures, plus management as a percent of rent.
- `Loan balance`, `Interest rate`, and `Monthly P&I` — mortgage inputs used to calculate debt service and remaining loan balance.
- `Purchase price`, `Initial cash invested`, `Annual appreciation`, and `Selling costs` — return assumptions used to estimate sale proceeds, IRR, and total ROI.

## Notes

- This app uses Tailwind CSS classes for styling.
- The app calculates monthly and annual rental cash flow values and return metrics.
- The app stores your inputs in browser localStorage so your vacancy months and settings are restored after refresh.
