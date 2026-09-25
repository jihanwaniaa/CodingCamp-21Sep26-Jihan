// js/app.js — Expense & Budget Visualizer

// =============================================================================
// Type Definitions (JSDoc)
// =============================================================================

/**
 * @typedef {'Food' | 'Transport' | 'Fun'} Category
 */

/**
 * @typedef {Object} Transaction
 * @property {string}   id        - UUID v4 generated at creation time (crypto.randomUUID)
 * @property {string}   name      - Item name, 1–100 characters
 * @property {number}   amount    - Positive float, 0.01–999,999,999.99
 * @property {Category} category  - One of 'Food', 'Transport', or 'Fun'
 * @property {number}   timestamp - Date.now() at insertion; used for insertion-order sort
 */

/**
 * @typedef {Object} CategoryTotals
 * @property {number} Food      - Total spending for the Food category
 * @property {number} Transport - Total spending for the Transport category
 * @property {number} Fun       - Total spending for the Fun category
 */

/**
 * @typedef {Object} RawFormData
 * @property {string}   name
 * @property {string}   amount
 * @property {Category} category
 */

/**
 * @typedef {Object} FieldErrors
 * @property {string} [name]     - Error message for the name field
 * @property {string} [amount]   - Error message for the amount field
 * @property {string} [category] - Error message for the category field
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean}       valid
 * @property {RawFormData|null} transaction - Populated when valid === true
 * @property {FieldErrors|null} errors      - Populated when valid === false
 */

// =============================================================================
// Constants
// =============================================================================

/** @type {string} localStorage key used to persist the transaction array */
const STORAGE_KEY = 'ebv_transactions';

// =============================================================================
// StorageWriteError
// =============================================================================

/**
 * Thrown by StorageService.save() when localStorage is unavailable or a write
 * attempt fails (e.g. private-browsing quota restrictions, SecurityError).
 */
class StorageWriteError extends Error {
  /**
   * @param {string} message - Human-readable reason for the failure
   */
  constructor(message) {
    super(message);
    this.name = 'StorageWriteError';
  }
}

// =============================================================================
// UUID Generator
// =============================================================================

/**
 * Generates a UUID v4 string.
 *
 * Uses `crypto.randomUUID()` when available (all modern browsers).
 * Falls back to a `Math.random`-based implementation for environments where
 * `crypto.randomUUID` is absent (Requirement 7.2).
 *
 * @returns {string} A UUID v4 string, e.g. "550e8400-e29b-41d4-a716-446655440000"
 */
function generateUUID() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  // Math.random fallback — RFC 4122 §4.4 compliant UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================================
// StorageService
// =============================================================================

/**
 * Encapsulates all localStorage interactions.
 * The rest of the app never touches localStorage directly.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
const StorageService = {
  /**
   * Reads the transaction array from localStorage.
   *
   * - If the key is absent or the stored value is not valid JSON, an error
   *   banner is shown and an empty array is returned so the app can continue
   *   operating normally (Requirement 5.4).
   * - Any other unexpected error is also caught and treated the same way.
   *
   * @returns {Transaction[]} Parsed transaction array, or [] on failure
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      // Key absent — first run, no existing data
      if (raw === null) {
        return [];
      }

      const parsed = JSON.parse(raw);

      // Guard against non-array values stored under the key
      if (!Array.isArray(parsed)) {
        throw new SyntaxError('Stored value is not an array');
      }

      return parsed;
    } catch (err) {
      // Show the persistent error banner (Requirement 5.4)
      const banner = document.getElementById('storage-error-banner');
      if (banner) {
        banner.classList.remove('hidden');
      }
      return [];
    }
  },

  /**
   * Serializes the transaction array and writes it to localStorage synchronously.
   *
   * Throws StorageWriteError if:
   * - localStorage is unavailable (SecurityError in private-browsing, etc.)
   * - The write throws for any reason (e.g. quota exceeded)
   *
   * @param {Transaction[]} transactions - The full transaction array to persist
   * @throws {StorageWriteError}
   */
  save(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (err) {
      throw new StorageWriteError(
        `Failed to save transactions: ${err.message}`
      );
    }
  },
};

// =============================================================================
// AppState
// =============================================================================

/**
 * In-memory application state.
 *
 * Holds the canonical transactions array ordered by insertion (oldest first).
 * All mutations go through the helper functions below to keep side-effects
 * predictable and easy to trace.
 *
 * Requirements: 2.2
 */
const AppState = (() => {
  /** @type {Transaction[]} */
  let transactions = [];

  return {
    /**
     * Appends a transaction to the end of the list.
     * Push maintains insertion order; timestamp is set at creation time so
     * oldest-first sort is preserved naturally.
     *
     * @param {Transaction} tx - The transaction to add
     */
    addTransaction(tx) {
      transactions.push(tx);
    },

    /**
     * Removes the transaction with the given id from the list.
     * If no transaction matches, the list is left unchanged.
     *
     * @param {string} id - UUID of the transaction to remove
     */
    removeTransaction(id) {
      transactions = transactions.filter((tx) => tx.id !== id);
    },

    /**
     * Returns a shallow copy of the transactions array sorted by timestamp
     * ascending (oldest first) to guarantee consistent insertion-order display
     * even if entries were ever inserted out of order.
     *
     * @returns {Transaction[]}
     */
    getTransactions() {
      return transactions.slice().sort((a, b) => a.timestamp - b.timestamp);
    },
  };
})();

// =============================================================================
// Calculation Helpers
// =============================================================================

/**
 * Computes the total balance across all transactions.
 *
 * Sums each transaction's `amount` and returns the result formatted to exactly
 * 2 decimal places as a string (e.g. `"12.50"`).
 * Returns `"0.00"` for an empty or null array.
 *
 * Pure function — no side effects.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5
 *
 * @param {Transaction[]} transactions
 * @returns {string} Sum formatted to 2 decimal places
 */
function computeBalance(transactions) {
  if (!transactions || transactions.length === 0) {
    return '0.00';
  }

  const sum = transactions.reduce((acc, tx) => acc + tx.amount, 0);
  return Number.parseFloat(sum).toFixed(2);
}

/**
 * Computes the total spending amount per category.
 *
 * Always returns an object with all three category keys (`Food`, `Transport`,
 * `Fun`). Categories with no transactions receive a value of `0`.
 *
 * Pure function — no side effects.
 *
 * Requirements: 4.1, 4.6
 *
 * @param {Transaction[]} transactions
 * @returns {CategoryTotals}
 */
function computeCategoryTotals(transactions) {
  /** @type {CategoryTotals} */
  const totals = { Food: 0, Transport: 0, Fun: 0 };

  if (!transactions || transactions.length === 0) {
    return totals;
  }

  for (const tx of transactions) {
    if (Object.prototype.hasOwnProperty.call(totals, tx.category)) {
      totals[tx.category] += tx.amount;
    }
  }

  return totals;
}

// =============================================================================
// Validator
// =============================================================================

/** @type {Category[]} */
const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

/**
 * Validates Transaction_Form inputs and returns a structured result.
 *
 * Rules:
 * - name   : required; must not be empty or whitespace-only; max 100 characters
 * - amount : required; must be numeric; must be > 0; range 0.01–999,999,999.99
 * - category: must be one of 'Food', 'Transport', 'Fun'
 *
 * Pure function — no side effects.
 *
 * Requirements: 1.1, 1.2, 1.3
 *
 * @param {string}   name     - Raw value from the item-name text input
 * @param {string}   amount   - Raw value from the amount numeric input
 * @param {string}   category - Raw value from the category dropdown
 * @returns {ValidationResult}
 */
function validateForm(name, amount, category) {
  /** @type {FieldErrors} */
  const errors = {};

  // --- Name validation ---
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (trimmedName.length === 0) {
    errors.name = 'Item name is required.';
  } else if (trimmedName.length > 100) {
    // Defensive guard: the HTML maxlength attribute also enforces this, but
    // the Validator must be the authoritative source of truth (Req 1.1, 1.2).
    errors.name = 'Item name must not exceed 100 characters.';
  }

  // --- Amount validation ---
  const trimmedAmount = typeof amount === 'string' ? amount.trim() : '';
  const parsedAmount = Number(trimmedAmount);

  if (trimmedAmount.length === 0 || Number.isNaN(parsedAmount)) {
    errors.amount = 'Amount must be a numeric value.';
  } else if (parsedAmount <= 0) {
    errors.amount = 'Amount must be greater than 0.';
  } else if (parsedAmount < 0.01 || parsedAmount > 999_999_999.99) {
    errors.amount = 'Amount must be between 0.01 and 999,999,999.99.';
  }

  // --- Category validation ---
  if (!VALID_CATEGORIES.includes(/** @type {any} */ (category))) {
    errors.category = 'Please select a category.';
  }

  // --- Build result ---
  if (Object.keys(errors).length > 0) {
    return { valid: false, errors, transaction: null };
  }

  return {
    valid: true,
    errors: null,
    transaction: {
      name: trimmedName,
      amount: trimmedAmount,
      category: /** @type {Category} */ (category),
    },
  };
}

// =============================================================================
// Form Error Renderers
// =============================================================================

/**
 * Injects inline error messages into the `role="alert"` elements adjacent to
 * each form field. Any field not present in `errors` has its alert cleared.
 *
 * The three alert element IDs match the HTML:
 * - `#item-name-error`  → name field error
 * - `#amount-error`     → amount field error
 * - `#category-error`   → category field error
 *
 * Requirements: 1.3
 *
 * @param {FieldErrors} errors - Object whose keys are field names and values
 *                               are the error message strings to display
 */
function renderFormErrors(errors) {
  const fieldMap = {
    name:     'item-name-error',
    amount:   'amount-error',
    category: 'category-error',
  };

  for (const [field, elementId] of Object.entries(fieldMap)) {
    const alertEl = document.getElementById(elementId);
    if (!alertEl) continue;

    const message = errors && errors[field] ? errors[field] : '';
    alertEl.textContent = message;

    // Toggle visibility: show when there is an error, hide otherwise
    if (message) {
      alertEl.classList.remove('hidden');
    } else {
      alertEl.classList.add('hidden');
    }
  }
}

/**
 * Clears all three form field alert elements, hiding any previously displayed
 * inline error messages.
 *
 * Requirements: 1.3
 */
function clearFormErrors() {
  const errorIds = ['item-name-error', 'amount-error', 'category-error'];

  for (const id of errorIds) {
    const alertEl = document.getElementById(id);
    if (!alertEl) continue;

    alertEl.textContent = '';
    alertEl.classList.add('hidden');
  }
}

// =============================================================================
// View Renderer — Transaction List
// =============================================================================

/**
 * Clears and rebuilds the Transaction_List UI from the given transactions array.
 *
 * - Sorts by timestamp ascending (oldest first, newest last) before rendering,
 *   consistent with Requirement 2.2.
 * - Shows an empty-state message when the array is empty (Requirement 2.6).
 * - Each list item renders: item name, amount (2 d.p. with "$" symbol),
 *   category label, and a delete button with a `data-id` attribute (Requirement 2.1).
 * - The list container already has `overflow-y: scroll` in CSS so vertical
 *   scrolling kicks in automatically when content overflows (Requirement 2.3).
 *
 * Pure DOM manipulator — no AppState mutations.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.6
 *
 * @param {Transaction[]} transactions - Array of transactions to render
 */
function renderTransactionList(transactions) {
  const listEl = document.getElementById('transaction-list');
  const emptyEl = document.getElementById('transaction-list-empty');

  if (!listEl) return;

  // Clear existing entries
  listEl.innerHTML = '';

  // Sort: oldest first (lowest timestamp first)
  const sorted = (transactions || [])
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length === 0) {
    // Show empty-state message
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  // Hide empty-state message when there are transactions
  if (emptyEl) emptyEl.classList.add('hidden');

  for (const tx of sorted) {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = tx.id;

    // Item name — capped at 100 characters defensively
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tx-name';
    nameSpan.textContent = tx.name.slice(0, 100);

    // Amount — formatted to 2 decimal places with "$" currency symbol
    const amountSpan = document.createElement('span');
    amountSpan.className = 'tx-amount';
    amountSpan.textContent = '$' + Number(tx.amount).toFixed(2);

    // Category label
    const categorySpan = document.createElement('span');
    categorySpan.className = 'tx-category';
    categorySpan.textContent = tx.category;

    // Delete button — carries the transaction id for event delegation
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'tx-delete';
    deleteBtn.dataset.id = tx.id;
    deleteBtn.setAttribute('aria-label', `Delete transaction: ${tx.name}`);
    deleteBtn.textContent = 'Delete';

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(deleteBtn);

    listEl.appendChild(li);
  }
}

// =============================================================================
// View Renderer — Balance Display
// =============================================================================

/**
 * Updates the Balance_Display element with the current total spending.
 *
 * - Delegates the sum calculation to `computeBalance`, which handles empty
 *   arrays and returns "0.00" as required (Requirement 3.4).
 * - The formatted value (always 2 decimal places) is injected into
 *   `#balance-amount` (Requirement 3.1).
 *
 * Pure DOM manipulator — no AppState mutations.
 *
 * Requirements: 3.1, 3.4
 *
 * @param {Transaction[]} transactions - Array of transactions to sum
 */
function renderBalanceDisplay(transactions) {
  const balanceEl = document.getElementById('balance-amount');
  if (!balanceEl) return;

  balanceEl.textContent = computeBalance(transactions);
}

// =============================================================================
// Chart — Category Colors & Helpers
// =============================================================================

/**
 * Fixed, unique colors per category used for Chart.js slices and CSS labels.
 * Requirements: 4.4
 */
const CATEGORY_COLORS = {
  Food:      '#4CAF50', // green
  Transport: '#2196F3', // blue
  Fun:       '#FF9800', // orange
};

/**
 * Computes per-category slice percentages from a CategoryTotals object,
 * omitting any category whose total is 0.
 *
 * Returns an array of `{ label, value, percentage }` objects, where
 * `percentage` is rounded to 1 decimal place.
 *
 * Pure function — no side effects.
 *
 * Requirements: 4.1, 4.6, 4.7
 *
 * @param {CategoryTotals} totals
 * @returns {{ label: string, value: number, percentage: number }[]}
 */
function computeSlices(totals) {
  const grandTotal = totals.Food + totals.Transport + totals.Fun;

  if (grandTotal === 0) {
    return [];
  }

  /** @type {{ label: string, value: number, percentage: number }[]} */
  const slices = [];

  for (const [label, value] of Object.entries(totals)) {
    if (value > 0) {
      slices.push({
        label,
        value,
        percentage: Math.round((value / grandTotal) * 1000) / 10, // 1 d.p.
      });
    }
  }

  return slices;
}

// =============================================================================
// View Renderer — Pie Chart
// =============================================================================

/** @type {import('chart.js').Chart | null} */
let chartInstance = null;

/**
 * Creates the Chart.js Pie instance and attaches it to the given canvas element.
 *
 * - Called once on `DOMContentLoaded`.
 * - If Chart.js failed to load from CDN, shows the static `#chart-load-error`
 *   message and leaves `chartInstance` as null (Requirement 4.5 / error table).
 * - The initial chart is created with empty data; `renderChart` fills it in.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 *
 * @param {string} canvasId - The `id` attribute of the `<canvas>` element
 */
function initChart(canvasId) {
  // Guard: Chart.js CDN may have failed to load
  if (typeof Chart === 'undefined') {
    const errorEl = document.getElementById('chart-load-error');
    if (errorEl) errorEl.classList.remove('hidden');
    return;
  }

  const canvas = document.getElementById(canvasId);
  if (!(canvas instanceof HTMLCanvasElement)) return;

  chartInstance = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            /**
             * Shows "Label — X%" in the tooltip instead of raw amounts.
             *
             * @param {import('chart.js').TooltipItem<'pie'>} context
             * @returns {string}
             */
            label(context) {
              const dataset = context.chart.data.datasets[0];
              const meta = dataset._slicePercentages || [];
              const pct = meta[context.dataIndex] ?? context.parsed;
              return ` ${context.label}: ${pct}%`;
            },
          },
        },
      },
    },
  });
}

/**
 * Updates the Chart.js Pie chart to reflect the current transaction list.
 *
 * - Calls `computeCategoryTotals` then `computeSlices` to derive labels,
 *   data, and per-slice percentage strings (rounded to 1 d.p.).
 * - Omits zero-value categories (slice array contains only categories > 0).
 * - Shows the `#chart-empty` placeholder when there are no transactions.
 * - Hides the placeholder and updates the chart when transactions exist.
 * - Calls `chart.update('active')` after mutating chart data.
 *
 * If Chart.js never loaded (`chartInstance` is null) this function is a no-op.
 *
 * Pure DOM / chart mutator — no AppState mutations.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 *
 * @param {Transaction[]} transactions - The current list of transactions
 */
function renderChart(transactions) {
  const emptyEl = document.getElementById('chart-empty');

  // If Chart.js failed to load, just manage the empty-state element and bail.
  if (!chartInstance) {
    if (emptyEl) {
      const hasData = transactions && transactions.length > 0;
      emptyEl.classList.toggle('hidden', hasData);
    }
    return;
  }

  const totals = computeCategoryTotals(transactions || []);
  const slices = computeSlices(totals);

  if (slices.length === 0) {
    // No data — show empty-state message, clear chart data
    if (emptyEl) emptyEl.classList.remove('hidden');

    chartInstance.data.labels = [];
    chartInstance.data.datasets[0].data = [];
    chartInstance.data.datasets[0].backgroundColor = [];
    chartInstance.data.datasets[0]._slicePercentages = [];
    chartInstance.update('active');
    return;
  }

  // Hide empty-state message
  if (emptyEl) emptyEl.classList.add('hidden');

  // Build parallel arrays for Chart.js
  const labels      = slices.map((s) => `${s.label} (${s.percentage}%)`);
  const data        = slices.map((s) => s.value);
  const colors      = slices.map((s) => CATEGORY_COLORS[s.label] || '#999');
  const percentages = slices.map((s) => s.percentage);

  chartInstance.data.labels                           = labels;
  chartInstance.data.datasets[0].data                = data;
  chartInstance.data.datasets[0].backgroundColor     = colors;
  // Stash raw percentages for tooltip callback access
  chartInstance.data.datasets[0]._slicePercentages   = percentages;

  chartInstance.update('active');
}

// =============================================================================
// View Renderer — renderAll convenience function
// =============================================================================

/**
 * Calls all three View Renderers with the current in-memory transactions.
 *
 * This is the single update entry point used by the EventController after any
 * state mutation (add transaction, delete transaction) and on initial page load.
 * Centralising the call here ensures the Transaction_List, Balance_Display, and
 * Chart are always kept in sync with AppState.
 *
 * Requirements: 1.4, 2.4, 3.2, 3.3
 */
function renderAll() {
  const transactions = AppState.getTransactions();
  renderTransactionList(transactions);
  renderBalanceDisplay(transactions);
  renderChart(transactions);
}

// =============================================================================
// EventController — Form Submit Handler
// =============================================================================

/**
 * Handles the Transaction_Form `submit` event.
 *
 * Flow:
 * 1. Prevents the default browser form submission.
 * 2. Clears any previously displayed inline field errors.
 * 3. Reads the raw values from the three form fields.
 * 4. Passes them to `validateForm`.
 *
 * On **valid** input:
 * 5. Constructs a full `Transaction` object (generates UUID and timestamp).
 * 6. Calls `AppState.addTransaction` to update in-memory state.
 * 7. Calls `StorageService.save` to persist synchronously (Requirement 5.1).
 * 8. Calls `renderAll` to update Transaction_List, Balance_Display, and Chart.
 * 9. Resets the form: clears the item-name and amount fields, resets the
 *    category dropdown to its default unselected state (Requirement 1.5).
 *
 * On **invalid** input:
 * 10. Calls `renderFormErrors` to inject inline error messages adjacent to
 *     each invalid field (Requirement 1.3). No transaction is added.
 *
 * On `StorageWriteError` during save:
 * 11. Rolls back the just-added transaction from AppState.
 * 12. Shows a form-level error banner so the user knows the add failed.
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5, 5.1
 *
 * @param {SubmitEvent} event - The form submit event
 */
function handleFormSubmit(event) {
  event.preventDefault();

  // Clear any stale inline field errors before re-validating
  clearFormErrors();

  // Read raw field values from the DOM
  const nameInput     = /** @type {HTMLInputElement|null}  */ (document.getElementById('item-name'));
  const amountInput   = /** @type {HTMLInputElement|null}  */ (document.getElementById('amount'));
  const categoryInput = /** @type {HTMLSelectElement|null} */ (document.getElementById('category'));

  const rawName     = nameInput     ? nameInput.value     : '';
  const rawAmount   = amountInput   ? amountInput.value   : '';
  const rawCategory = categoryInput ? categoryInput.value : '';

  // Validate inputs
  const result = validateForm(rawName, rawAmount, rawCategory);

  if (!result.valid) {
    // Render inline error messages; do NOT add a transaction (Req 1.3)
    renderFormErrors(result.errors);
    return;
  }

  // Build the full Transaction object
  /** @type {Transaction} */
  const newTransaction = {
    id:        generateUUID(),
    name:      result.transaction.name,
    amount:    Number(result.transaction.amount),
    category:  result.transaction.category,
    timestamp: Date.now(),
  };

  // Mutate in-memory state first
  AppState.addTransaction(newTransaction);

  // Persist synchronously before any further interaction (Requirement 5.1)
  try {
    StorageService.save(AppState.getTransactions());
  } catch (err) {
    // Storage write failed — roll back the state mutation
    AppState.removeTransaction(newTransaction.id);

    // Show a form-level error so the user knows the add did not persist
    const formErrorBanner = document.getElementById('form-error-banner');
    if (formErrorBanner) {
      formErrorBanner.textContent =
        'Transaction could not be saved. Please try again.';
      formErrorBanner.classList.remove('hidden');
    }
    return;
  }

  // Update all three UI regions (Requirement 1.4)
  renderAll();

  // Reset form to its default state (Requirement 1.5)
  if (nameInput)     nameInput.value       = '';
  if (amountInput)   amountInput.value     = '';
  if (categoryInput) categoryInput.value   = '';

  // Also hide the form-level error banner in case it was visible from a
  // previous failed save attempt
  const formErrorBanner = document.getElementById('form-error-banner');
  if (formErrorBanner) {
    formErrorBanner.textContent = '';
    formErrorBanner.classList.add('hidden');
  }
}

// =============================================================================
// EventController — Delete Click Handler
// =============================================================================

/**
 * Handles click events delegated from the Transaction_List container.
 *
 * Uses event delegation: the listener is attached to the list container, so
 * a single handler covers all delete buttons regardless of when they were
 * added to the DOM. Clicks on non-delete elements are silently ignored.
 *
 * Flow:
 * 1. Checks that the clicked element (or its closest ancestor) is a delete
 *    button — identified by the `tx-delete` class and a `data-id` attribute.
 * 2. Reads the transaction `id` from `data-id`.
 * 3. Saves a reference to the transaction before removal (for rollback).
 * 4. Calls `AppState.removeTransaction` to update in-memory state.
 * 5. Calls `StorageService.save` to persist the updated list (Requirement 5.2).
 * 6. Calls `renderAll` to update the Transaction_List, Balance_Display, and
 *    Chart (Requirement 2.4).
 *
 * On `StorageWriteError` during save (Requirement 2.5):
 * 7. Rolls back the state by re-adding the removed transaction.
 * 8. Displays an error message in the `#form-error-banner` element so the
 *    user knows the delete did not persist.
 * 9. Does NOT call `renderAll` — the UI reflects the rolled-back state.
 *
 * Requirements: 2.4, 2.5, 5.2
 *
 * @param {MouseEvent} event - The click event bubbled up from the list container
 */
function handleDeleteClick(event) {
  // Locate the delete button that was clicked (or is an ancestor of the target)
  const target = /** @type {HTMLElement} */ (event.target);
  const deleteBtn = target.closest('.tx-delete');

  // Ignore clicks that did not originate from a delete button
  if (!deleteBtn) return;

  const id = /** @type {HTMLElement} */ (deleteBtn).dataset.id;
  if (!id) return;

  // Save a copy of the transaction before removing it so we can roll back
  // if the storage write fails (Requirement 2.5)
  const allBefore = AppState.getTransactions();
  const txToRemove = allBefore.find((tx) => tx.id === id);

  // Guard: transaction may have already been removed (e.g. double-click)
  if (!txToRemove) return;

  // Remove from in-memory state
  AppState.removeTransaction(id);

  // Persist the updated list synchronously (Requirement 5.2)
  try {
    StorageService.save(AppState.getTransactions());
  } catch (err) {
    // Storage write failed — roll back the state mutation so the transaction
    // is retained in the list, balance, and chart (Requirement 2.5)
    AppState.addTransaction(txToRemove);

    // Show a visible error message so the user understands the delete failed
    const errorBanner = document.getElementById('form-error-banner');
    if (errorBanner) {
      errorBanner.textContent =
        'Transaction could not be deleted. Please try again.';
      errorBanner.classList.remove('hidden');
    }

    // Re-render with the rolled-back state to keep the UI consistent
    renderAll();
    return;
  }

  // Update all three UI regions to reflect the deleted transaction (Req 2.4)
  renderAll();

  // Clear any previously displayed error banner on a successful delete
  const errorBanner = document.getElementById('form-error-banner');
  if (errorBanner) {
    errorBanner.textContent = '';
    errorBanner.classList.add('hidden');
  }
}

// =============================================================================
// Bootstrap — DOMContentLoaded
// =============================================================================

/**
 * Application entry point. Runs once the DOM is fully parsed.
 *
 * Sequence:
 * 1. Check for `localStorage` availability; show "browser not supported"
 *    banner and abort if unavailable (Requirements 7.3).
 * 2. Load persisted transactions via `StorageService.load()` and populate
 *    `AppState` (Requirements 5.3, 5.4).
 * 3. Initialise the Chart.js pie-chart instance (Requirement 4.1).
 * 4. Render the initial UI — list, balance, and chart (Requirements 5.3, 6.3).
 * 5. Attach the form `submit` handler (Requirements 1.2, 1.4).
 * 6. Attach a delegated `click` handler on the transaction list container for
 *    delete buttons (Requirement 2.4).
 * 7. Enforce the 100-character input limit on the item-name field via an
 *    `input` event listener (Requirement 1.6).
 *
 * Requirements: 1.6, 5.3, 5.4, 6.3, 7.3
 */
document.addEventListener('DOMContentLoaded', () => {
  // ── 1. Browser-compatibility check ────────────────────────────────────────
  // localStorage is a required Web API for this app (Requirement 5.x, 7.3).
  // If it is unavailable (SecurityError in some private-browsing contexts, or
  // an older browser), inform the user and stop further initialisation.
  let localStorageAvailable = false;
  try {
    const testKey = '__ebv_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    localStorageAvailable = true;
  } catch (_) {
    localStorageAvailable = false;
  }

  if (!localStorageAvailable) {
    const unsupportedBanner = document.getElementById('browser-error-banner');
    if (unsupportedBanner) {
      unsupportedBanner.classList.remove('hidden');
    }
    // Do not proceed — the app cannot function without localStorage
    return;
  }

  // ── 2. Load persisted data ─────────────────────────────────────────────────
  // StorageService.load() handles missing keys, parse errors, and will show
  // the storage-error-banner automatically on failure (Requirement 5.4).
  const persisted = StorageService.load();
  for (const tx of persisted) {
    AppState.addTransaction(tx);
  }

  // ── 3. Initialise the chart ────────────────────────────────────────────────
  initChart('chart-canvas');

  // ── 4. Render the initial UI ───────────────────────────────────────────────
  renderAll();

  // ── 5. Attach form submit handler ─────────────────────────────────────────
  const form = document.getElementById('transaction-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  // ── 6. Attach delegated delete handler ────────────────────────────────────
  // A single listener on the list container handles all delete buttons,
  // including those added dynamically after the initial render.
  const listContainer = document.getElementById('transaction-list');
  if (listContainer) {
    listContainer.addEventListener('click', handleDeleteClick);
  }

  // ── 7. Enforce 100-character limit on the item-name field ─────────────────
  // The HTML `maxlength` attribute also enforces this, but an `input` listener
  // provides an extra safeguard and can be used to trim/warn in real time
  // (Requirement 1.6).
  const nameInput = document.getElementById('item-name');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      if (nameInput.value.length > 100) {
        nameInput.value = nameInput.value.slice(0, 100);
      }
    });
  }
});
