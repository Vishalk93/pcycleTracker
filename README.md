# Cycle Calendar

A period-tracking calendar: tap a start and end date to log a period, see average cycle length, and get a predicted next period. Built with React + TypeScript + Vite.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Data

Logged periods are stored in the browser's `localStorage` under the key
`cycle-periods-v1`. Nothing leaves the device.

Predictions are simple estimates based on past cycle length — not medical
advice and not a form of birth control.
