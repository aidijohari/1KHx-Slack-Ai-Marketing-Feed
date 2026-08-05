# ST Cloud Looker Studio Style Guide

Source analyzed: `/Users/aidi/Downloads/ST_Cloud_Dashboard.pdf` (3 pages, extracted on 2026-03-03).

## 1) Design intent
A light, neutral dashboard with compact data density and a purple-led brand accent. Most charts sit inside white rounded cards on a soft gray canvas, with restrained grid lines and small axis labels.

## 2) Colour tokens
Use these as your default report theme colours.

### Core neutrals
- Canvas background: `#F2F2F2`
- Card background: `#FFFFFF`
- Divider / subtle border: `#B8B8B8`
- Grid line: `#EFEFEF`
- Body text: `#3C4043`
- Secondary text: `#666666`
- Header text emphasis: `#434343`

### Brand and chart accents
- Primary purple: `#5D2A8F` (close vector value `#5E2B90`)
- Purple tint/fill: `#E5DCED`
- Teal accent: `#2FB09A`
- Teal light: `#88D2C5`
- Gold/amber highlight: `#F4B214`
- Gold light: `#FCEFCF`

### Recommended categorical palette order
1. `#5D2A8F`
2. `#2FB09A`
3. `#F4B214`
4. `#88D2C5`
5. `#B8B8B8`
6. `#434343`
Apply this order in Looker Studio at: `Theme and layout` -> `Edit theme` -> `Data styles` -> `Chart palette`.

## 3) Typography
The export embeds Type3 fonts, but the visual pattern is a compact sans-serif system.

### Suggested Looker setup
- Font family: `Roboto` (or clean sans-serif fallback)
- KPI label/title: `9 px`, medium weight
- KPI value: `21 px`, regular/medium weight
- Chart title: `9 px`, medium weight
- Axis, legend, table cells: `7.5-8 px`
- Text colour default: `#3C4043`
- Secondary labels: `#666666`

## 4) Spacing, shape, layout
- Page width observed: `900 px` (keep a fixed desktop canvas for consistency).
- Overall layout: 3-row modular grid with equal card rhythm.
- Card corner radius: `10-12 px`.
- Card internal padding: `10-12 px`.
- Inter-card gap: `8-12 px`.
- Section labels (e.g., "EMBEDDED AI", "NATIVE AI") use capsule chips:
  - Chip bg: `#FFFFFF`
  - Radius: full/9999 px
  - Text: `#434343`, small uppercase-ish label

## 5) Chart styling standards

### Time-series (line/area)
- Primary series stroke: `#5D2A8F`, line width `1.0-1.2 px`.
- Optional area fill under line: `#E5DCED` at `35-45%` opacity.
- Grid lines: `#EFEFEF`, thin.
- Axis labels: `7.5-8 px`, `#666666`.
- Minimal markers; only use points if required for sparse data.

### Vertical bar charts
- Bar colour: `#5D2A8F` for primary metric.
- Use a single colour unless comparing categories.
- Keep grid subtle and avoid heavy outlines.

### Multi-series line charts
- Use palette order (purple, teal, gold) with low visual noise.
- Maintain consistent series-to-colour mapping across all pages.

### Tables / pivot tables
- Header row text: `#3C4043`, semibold feel.
- Row text: `#3C4043` at small size.
- Numeric emphasis via conditional background fills:
  - High value: `#F4B214` / `#FCEFCF`
  - Mid value: neutral warm tint
  - Low value: very light neutral
- Row separators: very light gray (`#EFEFEF` or none).

## 6) Component recipes

### KPI card
- Title top-left (`9 px`, `#3C4043`)
- Value below (`21 px`, `#3C4043`)
- White card with rounded corners
- No heavy border; rely on contrast with gray canvas

### Section header chip
- Short uppercase label (e.g., "EMBEDDED AI")
- White rounded capsule over gray canvas
- Use as page/subsection grouping anchor

## 7) Looker Studio theme settings to apply
Create a reusable custom theme with:
- Open `Theme and layout` -> `Edit theme`.
- In `Data styles`, set `Chart palette` swatches in this order: `#5D2A8F`, `#2FB09A`, `#F4B214`, `#88D2C5`, `#B8B8B8`, `#434343`.
- For `Colour by`, use `Series order` as default. Use `Dimension values` only when you need fixed colours by category, then use `Manage dimension value colours`.
- Background colour: `#F2F2F2`
- Default font colour: `#3C4043`
- Card/container style: white with rounded corners
- Grid lines: light gray only
- Table conditional format preset: amber heatmap

## 8) Consistency rules for future reports
- Keep chart titles in the same sentence-case pattern: `Metric (Window)`.
- Use one primary color language per chart family (purple first).
- Do not mix saturated backgrounds; preserve neutral canvas.
- Prefer compact labels over long legends; truncate long strings.
- Keep all cards aligned to a single baseline grid.

## 9) Known limits from PDF-based extraction
- Exact original font family cannot be recovered reliably from this PDF export (fonts are embedded as Type3 objects).
- Some colors may vary by 1-2 RGB values due anti-aliasing in rasterized previews.
