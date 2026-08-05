# ST Cloud Looker Studio Formatting Instructions

This playbook turns the style guide into an implementation workflow you can reuse for every new report.

Primary reference: `/Users/aidi/Sites/1KHx-Slack-Ai-Marketing-Feed/docs/looker-style-guide.md`

## Can we create a reusable theme?
Short answer: **yes, partially**.

Looker Studio does not support importing a full external theme file like CSS. The reliable approach is:
- Create one **base template report** with all theme settings and styled components.
- Duplicate this base report for every new project.

This gives you practical theme reuse and consistent styling.

## 1) One-time setup (create your base template report)

1. Create a report named `ST Cloud - Base Template`.
2. Open **Theme and layout**.
3. In the right panel, use **Edit theme**.
4. Under **Data styles**, set **Chart palette** order to:
   - `#5D2A8F`
   - `#2FB09A`
   - `#F4B214`
   - `#88D2C5`
   - `#B8B8B8`
   - `#434343`
5. Under **Data styles** -> **Colour by**, keep **Series order** as default for metric-based charts. Switch to **Dimension values** for category/platform charts (for example `network` with Facebook/Instagram/LinkedIn/TikTok), then click **Manage dimension value colours** to lock each category to a fixed colour.
6. Set **Background colour** to `#F2F2F2` and **Font colour** to `#3C4043`.
7. Set typography defaults (or closest available):
   - Title: `9 px`
   - Body/axis/table: `8 px`
   - KPI value: `21 px`
8. Add a sample card/container style:
   - Fill: `#FFFFFF`
   - Border: none or `#B8B8B8` thin
   - Corner radius: `10-12 px`
9. Add one of each pre-styled chart type (line, bar, table, scorecard) as reusable components.
10. Add one styled section-chip label component (white pill style).
11. Save this report and never use it for production data delivery.

## 2) New report workflow (always follow)

1. Duplicate `ST Cloud - Base Template`.
2. Rename using convention: `ST Cloud - <Client/Project> - <Purpose>`.
3. Replace/attach new data sources.
4. Keep theme and layout unchanged unless approved by design owner.
5. Build pages using duplicated pre-styled components first, then bind metrics/dimensions.

## 3) Chart formatting rules by type

### A) Scorecards (KPI)
- Label size: `9 px`, color `#3C4043`
- Value size: `21 px`, colour `#3C4043`
- Background: `#FFFFFF`
- Corner radius: `10-12 px`

### B) Time-series line charts
- Primary stroke/line colour: `#5D2A8F`
- Optional fill: `#E5DCED` with low opacity
- Grid lines: `#EFEFEF`
- Axis labels: `8 px`, `#666666`
- Keep labels compact and avoid extra decoration

### C) Bar charts
- Primary bars colour: `#5D2A8F`
- Secondary series (if needed): `#2FB09A`, then `#F4B214`
- Grid lines: subtle (`#EFEFEF`)

### D) Tables / pivots
- Header text: `#3C4043`
- Body text: `8 px`, `#3C4043`
- Conditional format heatmap:
  - High: `#F4B214`
  - Mid: `#FCEFCF`
  - Low: near-white neutral
- Keep separators very light

## 3.1) How to use `Colour by` correctly

### What it means
- **Series order**: Looker assigns colours by metric position in the chart (series 1 uses palette colour 1, series 2 uses palette colour 2, and so on).
- **Dimension values**: Looker assigns colours by category value (for example, `Facebook`, `Instagram`, `TikTok`), so each category keeps a stable colour.

### When to use each
- Use **Series order** for metric-driven charts where series are fixed, such as `impressions`, `reach`, `engagements`.
- Use **Dimension values** for category-driven charts where category identity matters across pages, such as `network`, `country`, or `campaign`.

### How to apply it (per chart)
1. Select the chart.
2. Open the right panel and go to **Style**.
3. In **Data styles**, find **Colour by**.
4. Choose **Series order** for default behavior.
5. If you need fixed category colours, choose **Dimension values**.
6. Click **Manage dimension value colours**.
7. Map each category to fixed colours.
8. Reuse the same mapping in other charts of the same category set.

### Optional: social platform brand mapping
If the chart dimension is a social platform (for example `network`), you can map categories to their platform brand colours instead of the report palette. Use this only for platform-comparison visuals.

Commonly used mappings:
- `Facebook` -> `#1877F2`
- `Instagram` -> `#E4405F` (single-colour fallback for the gradient brand system)
- `LinkedIn` -> `#0A66C2`
- `TikTok` -> `#000000` (or `#25F4EE` / `#FE2C55` for accent series)
- `YouTube` -> `#FF0000`
- `X / Twitter` -> `#000000`

Implementation rule:
- Keep one mapping table for the whole report and apply the same `Dimension values` mapping to every chart using that dimension.
- Verify colours against each platform's current official brand resources before publishing external-facing reports.

## 4) Layout system

- Keep fixed desktop canvas feel (template baseline is ~`900 px` width).
- Card spacing: `8-12 px` gaps.
- Card padding: `10-12 px` internal.
- Align cards to a consistent grid; avoid ad-hoc resizing.
- Use white pill section headers for subsection grouping.

## 5) Naming and copy standards

- Chart titles use sentence case and period window format.
- Pattern: `<Metric> (<Window>)`.
- Examples:
  - `Active Users Over Time (30 Day)`
  - `Top Countries (30 Day)`
  - `Cost Per Day Breakdown ($)`

## 6) QA checklist before publishing

Use this as release gate for each new report page.

1. Background is `#F2F2F2` and all main cards are white.
2. No unapproved colors outside the palette.
3. Scorecard labels/values use correct size hierarchy (`9 px` / `21 px`).
4. Axis/table text is small and consistent (`~8 px`).
5. Grid lines are subtle and not dominant.
6. Chart titles follow naming convention.
7. No misaligned cards; spacing is consistent.
8. Conditional formatting uses amber scale consistently.
9. Cross-page series colors are mapped consistently.

## 7) Governance recommendation

Assign one owner to the base template. Only this owner can:
- Change palette
- Change typography scale
- Change spacing/radius rules

When design updates are approved:
1. Update the base template first.
2. Update `/Users/aidi/Sites/1KHx-Slack-Ai-Marketing-Feed/docs/looker-style-guide.md`.
3. Announce change notes to report builders.

## 8) Optional acceleration

If you produce many reports, maintain a **component page** in the template containing:
- Pre-styled KPI row
- Pre-styled 2-column line chart section
- Pre-styled table + chart combo row

Builders can duplicate these blocks per page and swap data fields only.
