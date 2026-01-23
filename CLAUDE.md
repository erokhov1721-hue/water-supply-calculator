# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Water Supply Calculator (Калькулятор водоснабжения) - a web-based engineering calculator for designing residential building water supply systems. Calculates risers, pipes, fittings, and generates specifications for plumbing installations.

## Development Commands

```bash
# Start local development server
npm run start
# Uses: npx serve .
```

No build step required - this is a vanilla JavaScript ES modules project served statically.

## Architecture

### Module Structure

```
src/
├── main.js          # App entry point, event handlers, global API (window.app)
├── state.js         # Centralized state management for sections/zones/params
├── calculations.js  # All engineering calculations (zone heights, risers, BOM)
├── render.js        # DOM rendering functions for UI components
├── constants.js     # Domain constants (pipe diameters, album types, BOM templates)
├── storage.js       # localStorage persistence for projects
├── tabs.js          # Tab navigation system
├── export.js        # Excel export via SheetJS
└── import.js        # Excel import parsing
```

### Data Flow

1. **State** (`state.js`): Central `sections` array holds all building data. Each section contains floors, apartments by floor, zones with pipe diameters, and MOP (corridor piping) parameters.

2. **Calculations** (`calculations.js`): Pure functions compute derived data from sections:
   - `computeFloorsData()` - per-floor aggregations
   - `computeZonesData()` - zone summaries with riser lengths and BOM
   - `computeRisersByDiameter()` - pipe counts by system (V1/T3/T4) and diameter

3. **Rendering** (`render.js`): Takes calculation results and updates DOM. Uses inline event handlers that call `window.app.*` methods.

4. **Persistence** (`storage.js`): Projects saved to localStorage with full state serialization.

### Key Domain Concepts

- **Sections (Корпуса)**: Building sections, each with floors and apartments
- **Zones**: Vertical divisions within a section, each with its own riser count and pipe diameters
- **Systems**: V1 (cold water), T3 (hot water supply), T4 (hot water return)
- **Albums (КУУ)**: Metering unit configuration types: collector, collector_pre_apt, pre_apt
- **MOP**: Common corridor PP-R piping calculations

### State Management Pattern

State changes flow through exported functions in `state.js` that:
1. Modify the `sections` array
2. Call `notifyStateChange()` which triggers autosave

The `window.app` object in `main.js` wraps state functions and triggers recalculation + re-render.

### External Dependencies

- **SheetJS (XLSX)**: Loaded via CDN for Excel import/export. Available as global `XLSX` object.