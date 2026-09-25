# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a client-side SPA using plain HTML, CSS, and Vanilla JavaScript. The app follows a Model → Controller → View architecture inside a single `js/app.js` file, with Chart.js loaded via CDN. All data is persisted to `localStorage`. The tasks below are ordered so each step builds on the previous, ending with full wiring and integration.

---

## Tasks

- [x] 1. Set up project file structure and HTML scaffold
  - Create `index.html` at the project root with semantic HTML structure: Balance_Display section, Transaction_Form, Transaction_List container, and Chart canvas
  - Add CDN `<script>` tag for Chart.js v4 from cdnjs
  - Add `<link>` for `css/style.css` and `<script defer>` for `js/app.js`
  - Add ARIA landmark regions, `role="alert"` error banner elements, and `aria-live="polite"` attributes for accessibility
  - Create empty `css/style.css` and `js/app.js` placeholder files
  - _Requirements: 6.1, 6.2, 7.1, 7.3_

- [x] 2. Implement data models and StorageService
  - [x] 2.1 Define the `Transaction` typedef and `CategoryTotals` typedef as JSDoc in `app.js`
    - Include `id` (string UUID), `name` (string), `amount` (number), `category` ('Food'|'Transport'|'Fun'), `timestamp` (number)
    - Define `STORAGE_KEY = 'ebv_transactions'`
    - _Requirements: 5.1, 5.2_

  - [x] 2.2 Implement `StorageService.load()` and `StorageService.save()`
    - `load()` reads and JSON-parses from `localStorage`; returns `[]` and triggers error banner on missing key or parse failure
    - `save(transactions)` serializes and writes synchronously; throws `StorageWriteError` if `localStorage` is unavailable
    - Implement UUID generation with `crypto.randomUUID` and a `Math.random` fallback
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.2_

  - [ ]* 2.3 Write property test for storage round-trip (Property 4)
    - **Property 4: Storage round-trip preserves transactions**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Use `fc.array(transactionArbitrary)` → assert `load(save(txs))` is structurally equal to `txs`

- [x] 3. Implement AppState and pure calculation helpers
  - [x] 3.1 Implement `AppState` object with `addTransaction`, `removeTransaction`, and `getTransactions` helpers in `app.js`
    - State holds `transactions[]` ordered by insertion (oldest first via `timestamp`)
    - _Requirements: 2.2_

  - [x] 3.2 Implement `computeBalance(transactions)` and `computeCategoryTotals(transactions)` pure functions
    - `computeBalance` returns sum formatted to exactly 2 decimal places
    - `computeCategoryTotals` returns `{Food, Transport, Fun}` with 0 for absent categories
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 4.6_

  - [ ]* 3.3 Write property test for balance sum invariant (Property 3)
    - **Property 3: Balance equals sum of transaction amounts**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
    - Use `fc.array(transactionArbitrary)` → assert `computeBalance(txs) === txs.reduce((s, t) => s + t.amount, 0)` formatted to 2 d.p.

  - [ ]* 3.4 Write property test for empty-category omission (Property 7)
    - **Property 7: Empty-category slices are omitted**
    - **Validates: Requirements 4.6, 4.7**
    - Use `fc.array` with only Food transactions → assert `computeCategoryTotals` returns 0 for Transport and Fun

- [x] 4. Implement the Validator
  - [x] 4.1 Implement `validateForm(name, amount, category)` in `app.js`
    - Rejects empty string or whitespace-only name (max 100 chars)
    - Rejects non-numeric, zero, negative, or out-of-range amounts (0.01–999,999,999.99)
    - Rejects missing category
    - Returns `{ valid: true, transaction: RawFormData }` or `{ valid: false, errors: FieldErrors }`
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 4.2 Write property test for whitespace name rejection (Property 1)
    - **Property 1: Whitespace and empty item names are rejected**
    - **Validates: Requirements 1.2, 1.3**
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))` → assert `validateForm(ws, '1', 'Food').valid === false`

  - [ ]* 4.3 Write property test for amount boundary enforcement (Property 2)
    - **Property 2: Amount boundary enforcement**
    - **Validates: Requirements 1.2, 1.3**
    - Use `fc.float` outside [0.01, 999999999.99] → assert `validateForm('x', badAmt, 'Food').valid === false`

- [x] 5. Implement View Renderers
  - [x] 5.1 Implement `renderTransactionList(transactions)` in `app.js`
    - Clears and rebuilds list DOM; shows empty-state message when array is empty
    - Each entry renders item name (≤100 chars), amount (2 d.p. with currency symbol), category label, and delete button with `data-id` attribute
    - Applies insertion-order sort (oldest first, newest last)
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x] 5.2 Implement `renderBalanceDisplay(transactions)` in `app.js`
    - Sums amounts via `computeBalance`, injects into Balance_Display element
    - Shows `0.00` when no transactions exist
    - _Requirements: 3.1, 3.4_

  - [x] 5.3 Implement `initChart(canvasId)` and `renderChart(transactions)` in `app.js`
    - `initChart` creates a Chart.js Pie instance on `DOMContentLoaded`; shows static error if Chart.js CDN failed to load
    - `renderChart` calls `computeCategoryTotals`, omits zero-value categories, updates labels and slice percentages (rounded to 1 d.p.), and calls `chart.update('active')`
    - Shows empty-state message when array is empty
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 5.4 Write property test for chart slice percentages (Property 5)
    - **Property 5: Chart slice percentages sum to 100 %**
    - **Validates: Requirements 4.1, 4.7**
    - Use `fc.array(transactionArbitrary, {minLength: 1})` → assert `sum(slicePercentages) ≈ 100` (±0.1 %)

  - [x] 5.5 Implement `renderFormErrors(errors)` and `clearFormErrors()` helper functions
    - Injects inline error messages adjacent to each invalid field
    - Uses `role="alert"` elements already in the HTML
    - _Requirements: 1.3_

  - [x] 5.6 Implement `renderAll()` convenience function
    - Calls `renderTransactionList`, `renderBalanceDisplay`, and `renderChart` with `AppState.getTransactions()`
    - _Requirements: 1.4, 2.4, 3.2, 3.3_

- [ ] 6. Checkpoint — Verify pure logic before wiring
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement EventController and wire the application
  - [x] 7.1 Implement `handleFormSubmit(event)` in `app.js`
    - Prevents default; reads form fields; calls `validateForm`
    - On valid: calls `AppState.addTransaction`, `StorageService.save`, `renderAll`, resets form fields and category dropdown to default
    - On invalid: calls `renderFormErrors`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 5.1_

  - [x] 7.2 Implement `handleDeleteClick(event)` in `app.js`
    - Reads `data-id` from the clicked delete button
    - Calls `AppState.removeTransaction`, `StorageService.save`, `renderAll`
    - On `StorageWriteError`: displays delete-error message, rolls back `AppState`
    - _Requirements: 2.4, 2.5, 5.2_

  - [ ]* 7.3 Write property test for delete removes exactly one (Property 6)
    - **Property 6: Delete removes exactly one transaction**
    - **Validates: Requirements 2.4**
    - Use `fc.array(transactionArbitrary, {minLength: 1})` + `fc.nat` for index → assert `removeTransaction(txs, id).length === txs.length - 1` and remaining elements unchanged

  - [x] 7.4 Wire `DOMContentLoaded` bootstrap in `app.js`
    - Check for `localStorage` availability; display "browser not supported" banner if unavailable
    - Call `StorageService.load()` → populate `AppState`
    - Call `initChart('chart-canvas')`
    - Call `renderAll()`
    - Attach `handleFormSubmit` to the Transaction_Form `submit` event
    - Attach `handleDeleteClick` via event delegation on the Transaction_List container
    - Enforce 100-character input limit on the item name field via `input` event
    - _Requirements: 1.6, 5.3, 5.4, 6.3, 7.3_

- [x] 8. Implement CSS styling
  - [x] 8.1 Write base layout styles in `css/style.css`
    - Responsive single-column layout; Balance_Display prominently at top
    - Transaction_List container with fixed height and `overflow-y: scroll`
    - Form field layout with error message slots
    - _Requirements: 2.3, 3.1, 6.1_

  - [x] 8.2 Write Chart and category color styles
    - Define fixed unique colors per category (Food, Transport, Fun) consistent with Chart.js dataset colors
    - Style empty-state messages for list and chart areas
    - Ensure text and category label color contrast meets WCAG 2.1 AA
    - _Requirements: 4.4, 4.5_

- [-] 9. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 iterations each
- Unit tests use vitest (run with `vitest --run` for single execution)
- All property tests must include the comment `// Feature: expense-budget-visualizer, Property N: <property_text>`
- Each task references specific requirements for traceability
- No build step or package manager is required for the app itself — tests run in Node against the pure logic functions
- The Chart.js instance is created once and reused (no destroy/recreate) to prevent canvas flickering

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1"] },
    { "id": 2, "tasks": ["2.3", "3.2", "4.1"] },
    { "id": 3, "tasks": ["3.3", "3.4", "4.2", "4.3", "5.1", "5.2", "5.3", "5.5"] },
    { "id": 4, "tasks": ["5.4", "5.6"] },
    { "id": 5, "tasks": ["7.1", "7.2", "8.1"] },
    { "id": 6, "tasks": ["7.3", "7.4", "8.2"] }
  ]
}
```
