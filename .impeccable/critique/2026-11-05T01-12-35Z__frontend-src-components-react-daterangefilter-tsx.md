---
target: Período de avaliação (frontend/src/components/react/DateRangeFilter.tsx)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Projects\\game-review-dashboard\\frontend\\src\\components\\react\\DateRangeFilter.tsx"
target_fingerprint: "sha256:963e90d6bd7099aaea57a3faeb8f9cf5df856b694aa0af5e0583d42a0f2f9089"
target_path: "C:\\Projects\\game-review-dashboard\\frontend\\src\\components\\react\\DateRangeFilter.tsx"
timestamp: 2026-11-05T01-12-35Z
slug: frontend-src-components-react-daterangefilter-tsx
closed: true
---
Method: dual-agent (A: 615ae8da-1a81-4902-b2b0-eae0a6e85e3c · B: 14bc9b8e-5e3f-4a71-bc34-db6228fb8093)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Popover header does not visibly state whether editing `Início` or `Fim`; `.is-filtered` turns both trigger borders `--accent`, masking which trigger is currently open; `isInRange`, `isSelected`, and `Fechar` have zero hover state. |
| 2 | Match System / Real World | 3 | Trigger buttons render raw ISO strings (`2020-01-01`) instead of localized `pt-BR` dates (`01/01/2020`); label says `"Período da avaliação"` vs `"Período de avaliação"`. |
| 3 | User Control and Freedom | 3 | Selecting `Início` immediately closes the popover (`setActiveField(null)`) instead of auto-advancing to `Fim` when `dateTo` is empty. |
| 4 | Consistency and Standards | 2 | Trigger height `h-9 min-h-[36px]` clashes with `.field-control` (`44px`); conditional mount skips `.combo-menu` `180ms` transition; inline `style` overrides hover states and reduced-motion rules. |
| 5 | Error Prevention | 3 | Dataset bounds (`2013-03-05` to `2021-01-23`) are well enforced, but picking an end date earlier than `dateFrom` silently wipes `dateFrom` without warning or visual preview. |
| 6 | Recognition Rather Than Recall | 2 | Popover covers the preset pills beneath it and lacks a visible header indicator (`Início` vs `Fim`) or live range preview. |
| 7 | Flexibility and Efficiency | 2 | Annual presets (`2017`–`2020`) are fast, but calendar grid lacks keyboard arrow navigation, focus management, and hover range preview. |
| 8 | Aesthetic and Minimalist Design | 2 | Flat Z-axis plane: popover uses identical `--surface` and `--line` tokens as underlying sidebar buttons, and `--shadow: none` in dark mode eliminates all elevation separation. |
| 9 | Error Recovery | 3 | `Limpar`, `Fechar`, and `Tudo` reset cleanly, though inverted bounds clear the opposite bound silently. |
| 10 | Help and Documentation | 3 | Matches the sidebar header window (`Março de 2013 a janeiro de 2021`), though disabled cutoff days lack explanatory tooltips. |
| **Total** | | **25/40** | **Acceptable (62.5%) — Solid functional skeleton, needs depth, motion, and state clarity** |

#### Design Specificity Verdict

**LLM assessment**: At the domain level, `DateRangeFilter.tsx` is authentically anchored to the **Reviews da Steam** dataset: it locks navigation to `2013-03-05` through `2021-01-23`, disables out-of-range months in 2013 and 2021, offers relevant annual presets (`Tudo`, `2020`–`2017`), and applies `--font-mono` to active dates. However, at the spatial and micro-interaction level, it breaks away from the tactile editorial precision of `global.css` and `combo.ts`:
1. **Planar Collision (Lack of Depth)**: When the calendar popover opens (`DateRangeFilter.tsx#L231-L243`), it floats directly over the `.preset-btn` pills (`Tudo`, `2020`...) and the `.seg-control` rows below (`Recomendação`, `Compra na Steam`). Because it uses the exact same `var(--surface)` background and `1px solid var(--line)` border as the sidebar and buttons underneath—and because `--shadow` is barely perceptible in light mode (`0.06` opacity) and completely disabled in dark mode (`--shadow: none` at `global.css#L58`)—the popover has almost no Z-axis separation. The eye reads the popover's footer (`Limpar`, `Fechar`) and grid as sitting on the same flat plane as the sidebar buttons.
2. **Missing Motion & Unperceivable Hovers**: Unlike `.combo-menu` (`global.css#L846-L862`), which glides in with `opacity` and `transform: translateY(8px)` over `180ms cubic-bezier(0.22, 1, 0.36, 1)`, `DateRangeFilter` conditionally mounts `{activeField && ...}` in `0ms` with no animation. Inside the popover, inline `style={{ backgroundColor: ... }}` on the `Fechar` button (`L407-L417`), selected days (`L370-L372`), and in-range days (`L373-L376`) completely blocks CSS hover feedback, while unselected days rely on a subtle `hover:bg-raised` (`#ffffff` → `#f0efec` in light mode) on small `28x28px` cells without border or accent contrast.

**Deterministic scan**: `impeccable detect --json` scanned `frontend/src/components/react/DateRangeFilter.tsx`, `frontend/src/components/react/FiltersIsland.tsx`, `frontend/src/components/Sidebar.astro`, and live `http://localhost:4321`, returning **0 automated violations** (`exit code 0`, `[]`). This confirms strict adherence to semantic ARIA attributes and CSS custom property tokens (no hardcoded hex values), while highlighting that the visual plane collision and inline-style hover overrides require design-level refinement rather than lint fixes.

**Visual overlays**: No reliable user-visible `[Human]` overlay is available in this CLI environment (fallback signal: browser mutation/presentation tool not exposed in CLI harness).

#### Overall Impression

Your intuition is completely right on both counts: **the popover suffers from figure-ground flattening against the sidebar controls beneath it, and its hover/entry micro-interactions are either too faint or blocked by inline styles.** Giving the popover true Z-axis depth (a dedicated multi-layered `--shadow-popover` that remains active in dark mode, a higher-contrast border token, a header bar indicating `Início` vs. `Fim`, and dimming the covered preset pills) paired with a `180ms` entry animation and tactile cell hovers will immediately make it feel like a first-class part of the design system.

#### What's Working

1. **Dataset-Aware Temporal Guardrails (`DateRangeFilter.tsx#L26-L39`, `#L132-L150`, `#L277-L285`)**: Locking the calendar to `2013-03-05`–`2021-01-23` and disabling invalid months in 2013 and 2021 prevents users from selecting empty date ranges outside the Kaggle dataset.
2. **Smart Initial View Synchronization (`DateRangeFilter.tsx#L52-L75`)**: Opening the calendar automatically jumps to the currently selected date or defaults to 2020 rather than the current system year, keeping the user anchored in the dataset's historical window.
3. **One-Click Annual Presets (`DateRangeFilter.tsx#L209-L228`)**: Reusing `.preset-btn` for `Tudo`, `2020`, `2019`, `2018`, and `2017` provides fast macro-filtering without requiring the user to open the popover for full-year slices.

#### Priority Issues

- **[P1] What**: **Popover lacks Z-axis elevation and figure-ground separation from underlying sidebar controls**
  - **Why it matters**: In `DateRangeFilter.tsx#L232-L243`, the popover uses `backgroundColor: 'var(--surface)'`, `borderColor: 'var(--line)'`, and `boxShadow: 'var(--shadow)'`. Because `--surface` and `--line` are identical to the sidebar and buttons underneath—and `html.dark` sets `--shadow: none` (`global.css#L58`)—the popover visually merges with the `.preset-btn` and `.seg-control` buttons below it, causing users to confuse which buttons belong to the calendar.
  - **Fix**:
    1. Add dedicated `--shadow-popover` and `--border-popover` tokens in `global.css` for both light and dark modes (e.g., layered shadow `0 16px 36px -6px rgba(28, 25, 21, 0.18), 0 4px 12px -2px rgba(28, 25, 21, 0.08)` in light mode and `0 18px 40px -6px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(239, 233, 222, 0.14)` in dark mode).
    2. Add a distinct top header strip (`background: var(--paper)`) with a small pointer caret aligned under `Início` (left) or `Fim` (right) and a label showing `"Selecionando: Início"` or `"Selecionando: Fim"`.
    3. Dim the underlying preset pills (`opacity-35 pointer-events-none`) while `activeField !== null` so the popover unmistakably owns the foreground layer.
  - **Suggested command**: `/impeccable polish`

- **[P1] What**: **Imperceptible day hovers, dead inline-styled buttons, and missing popover entry/exit animation**
  - **Why it matters**: Conditional rendering (`{activeField && ...}` on `L231`) makes the calendar snap in/out in `0ms` instead of using the `180ms cubic-bezier(0.22, 1, 0.36, 1)` motion of `.combo-menu`. Inside the popover, inline `style={{ backgroundColor: ... }}` on the `Fechar` button (`L407-L417`), `isSelected` days (`L370-L372`), and `isInRange` days (`L373-L376`) overrides CSS `:hover`, making them visually unresponsive. Unselected days (`L366`) only shift from `#ffffff` to `#f0efec` (`hover:bg-raised`), which is barely noticeable on `28x28px` cells.
  - **Fix**:
    1. Replace inline color styles in `DateRangeFilter.tsx` with semantic classes in `global.css` (`.date-popover`, `.date-cell`, `.date-cell.is-in-range`, `.date-cell.is-selected`, `.date-footer-btn`).
    2. Add a `180ms var(--ease)` entry transition (`opacity` + `translateY(6px) scale(0.98)`) matching `.combo-menu`, respecting `@media (prefers-reduced-motion: reduce)`.
    3. Give `.date-cell:hover:not(:disabled)` a crisp accent-tinted fill (`color-mix(in srgb, var(--accent) 14%, var(--raised))`), a `1px` accent-tinted border (`color-mix(in srgb, var(--accent) 45%, var(--line))`), and `active:scale-95` tactile press feedback.
    4. Track `hoveredDate` state so hovering over days while picking the second bound previews the date range in real time.
  - **Suggested command**: `/impeccable animate`

- **[P1] What**: **Indistinguishable active trigger state when filtered, raw ISO date display, and single-bound close friction**
  - **Why it matters**: When any date filter is active, `.sidebar-row.is-field.is-filtered .field-control` (`global.css#L200-L202`) sets `border-color: var(--accent)` on **both** `Início` and `Fim`. Clicking one to open the popover sets `borderColor: 'var(--accent)'` (`L181`, `L200`), producing zero visual distinction between the open trigger and the closed one. Furthermore, triggers display raw ISO strings (`2020-01-01` instead of `01/01/2020`) and immediately close the popover after picking `Início` (`L120`) instead of advancing to `Fim`.
  - **Fix**:
    1. Give the currently open trigger (`aria-expanded="true"`) a distinct active treatment (`background: var(--raised)`, inner accent ring `box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent)`, and a rotating calendar/chevron indicator).
    2. Format trigger labels in `pt-BR` (`01/01/2020` via `DD/MM/AAAA`) to match `PRODUCT.md`.
    3. When picking `Início` (`activeField === 'from'`) and `dateTo` is empty, automatically transition `setActiveField('to')` so the user can complete the range in one fluid open session.
  - **Suggested command**: `/impeccable clarify`

- **[P2] What**: **Keyboard focus order visits covered preset buttons before entering the open calendar dialog**
  - **Why it matters**: In DOM order (`DateRangeFilter.tsx#L170-L237`), `#filter-date-from` is followed by `#filter-date-to` and the 5 `.preset-btn` pills before the `role="dialog"` popover. Tabbing from `Início` moves focus behind the open popover into the covered buttons, and `WEEKDAYS` (`D, S, T, Q, Q, S, S` at `L28`) lack accessible labels.
  - **Fix**: Programmatically focus the active control inside the popover on open (and restore focus to the trigger on `Escape`/`Fechar`), add `abbr`/`aria-label` to weekday headers, and localize day `aria-label` attributes (`15 de janeiro de 2020`).
  - **Suggested command**: `/impeccable harden`

#### Persona Red Flags

**Alex (Impatient Power User)**: Clicks `Início`, selects `2019-03-01`, and the popover immediately closes (`DateRangeFilter.tsx#L120`), forcing another click on `Fim` to finish a range. Hovering over candidate end dates shows no live range preview, and picking an end date earlier than `dateFrom` (`L114-L115`) silently erases `dateFrom` instead of swapping or warning.

**Sam (Accessibility-Dependent User)**: Opens `Início` with `Enter` and presses `Tab`; focus travels through `Fim` and all 5 `.preset-btn` pills hidden underneath the floating dialog before reaching `Mês anterior` (`L247`). Screen reader announces single letters `Q, Q, S, S` for weekdays (`L332`) and raw ISO strings (`2020-01-15` at `L383`).

**Marina (Staff Data Engineer / Technical Evaluator — Project Persona)**: Switches to Dark Mode (`ThemeToggle`) and opens the calendar to inspect a Steam sale window. Because `html.dark` sets `--shadow: none` (`global.css#L58`), the popover has zero shadow over the sidebar controls below it, creating visual ambiguity between the calendar footer (`Limpar` / `Fechar`) and the `Recomendação` segmented buttons. Raw `YYYY-MM-DD` strings in the triggers contrast with the localized `pt-BR` formatting across the rest of the dashboard.

#### Minor Observations

- **Label preposition (`DateRangeFilter.tsx#L161`, `#L166`)**: Renders `"Período da avaliação"` (`da`), whereas the user prompt and natural `pt-BR` filter naming ("Período de avaliação") use `de`.
- **Trigger height mismatch (`DateRangeFilter.tsx#L177`, `#L196`)**: Uses `h-9 min-h-[36px]`, whereas `.field-control` in `global.css#L690` standardizes on `min-height: 44px`.
- **Silent cutoff days (`DateRangeFilter.tsx#L347`)**: Days `1–4` of March 2013 and `24–31` of January 2021 are disabled without a `title` tooltip explaining the dataset boundary (`05/03/2013 a 23/01/2021`).

#### Questions to Consider

- *"What if selecting `Início` automatically glided into selecting `Fim` inside the same open popover, with a live hover range highlight connecting the two dates?"*
- *"How much clearer would the sidebar hierarchy feel if the open popover cast a real dark-mode-safe elevation shadow, pointed to its active trigger (`Início` vs. `Fim`), and dimmed the 5 preset pills underneath it?"*
- *"Should the trigger buttons display compact `pt-BR` dates (`05/03/2013` or `05 mar 2013`) so they match the localized typography of the rest of the dashboard?"*
