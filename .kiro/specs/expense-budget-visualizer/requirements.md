# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track their daily expenses, categorize spending, and visualize their budget distribution through an interactive pie chart. The app runs entirely in the browser with no backend server, storing all data in the browser's Local Storage. It is built using HTML, CSS, and Vanilla JavaScript only, and is designed to be clean, fast, and easy to use as a standalone web page or browser extension.

---

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, an amount, and a category.
- **Transaction_Form**: The HTML form used to input a new transaction.
- **Transaction_List**: The scrollable UI component displaying all recorded transactions.
- **Balance_Display**: The UI component at the top of the App that shows the total of all transaction amounts.
- **Chart**: The pie chart component that visualizes spending distribution by category.
- **Storage**: The browser's Local Storage API used to persist transaction data client-side.
- **Category**: One of the three predefined expense groupings — Food, Transport, or Fun.
- **Validator**: The client-side logic that checks Transaction_Form inputs before submission.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Transaction_Form SHALL provide a text input field for the item name (max 100 characters), a numeric input field for the amount (range 0.01–999,999,999.99), and a dropdown selector with the options Food, Transport, and Fun.
2. WHEN the user submits the Transaction_Form, THE Validator SHALL check that the item name field is not empty, the amount field contains a positive numeric value within the valid range, and a category has been selected.
3. IF the Validator detects any empty or invalid field, THEN THE Transaction_Form SHALL display an inline error message adjacent to each invalid field indicating what is missing or invalid, and SHALL NOT add a transaction.
4. WHEN the Transaction_Form passes validation, THE App SHALL add the new Transaction to the Transaction_List, update the Balance_Display, and update the Chart within 1 second.
5. WHEN a Transaction is successfully added, THE Transaction_Form SHALL reset the item name field to empty, the amount field to empty, and the category dropdown to its default unselected state.
6. WHEN the user types in the item name field, THE Transaction_Form SHALL prevent input beyond 100 characters.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see a scrollable list of all my recorded transactions so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all recorded transactions, each showing the item name (up to 100 characters), amount (formatted to 2 decimal places with currency symbol), and category label.
2. WHILE transactions exist in Storage, THE Transaction_List SHALL render them sorted by insertion order with the most recently added transaction appearing last in the list.
3. WHEN the total height of all transaction entries exceeds the visible area of the Transaction_List container, THE Transaction_List SHALL become vertically scrollable.
4. WHEN the user clicks the delete button on a transaction, THE App SHALL remove that transaction from Storage, remove its entry from the Transaction_List, recalculate and update the Balance_Display, and recalculate and update the Chart.
5. IF the delete operation on a transaction fails, THEN THE App SHALL display an error message indicating the transaction could not be deleted and retain the transaction in the Transaction_List, Balance_Display, and Chart without modification.
6. WHEN all transactions have been deleted, THE Transaction_List SHALL display an empty-state message indicating no transactions have been recorded.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending amount displayed prominently so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts, formatted as a numeric value with exactly 2 decimal places, at the top of the App above all other content.
2. WHEN a new Transaction is added, THE Balance_Display SHALL update its displayed total within 1 second without requiring a page reload.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update its displayed total within 1 second without requiring a page reload.
4. WHILE no transactions exist, THE Balance_Display SHALL display a total of 0.00.
5. IF a transaction amount is non-numeric or missing, THEN THE Balance_Display SHALL exclude that transaction from the total and display the sum of all valid transactions.

---

### Requirement 4: Visual Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand how my budget is distributed.

#### Acceptance Criteria

1. THE Chart SHALL display a pie chart where each slice size corresponds to the percentage of total spending for that Category (Food, Transport, Fun).
2. WHEN a new Transaction is added, THE Chart SHALL update automatically to reflect the new spending distribution without requiring a page reload.
3. WHEN a Transaction is deleted, THE Chart SHALL update automatically to reflect the revised spending distribution without requiring a page reload.
4. THE Chart SHALL visually distinguish each Category using a unique, fixed color per category, with no two categories sharing the same color.
5. WHILE no transactions exist, THE Chart SHALL display an empty-state message indicating there is no data to visualize.
6. IF a Category has no transactions, THEN THE Chart SHALL omit that Category's slice from the pie chart entirely.
7. THE Chart SHALL display a label and percentage (rounded to 1 decimal place) for each visible slice.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved so that my data is not lost when I close or refresh the browser tab.

#### Acceptance Criteria

1. WHEN a new Transaction is added, THE Storage SHALL persist the updated transaction list to Local Storage immediately, completing the write operation before any subsequent user interaction is processed.
2. WHEN a Transaction is deleted, THE Storage SHALL persist the updated transaction list to Local Storage immediately, completing the write operation before any subsequent user interaction is processed.
3. WHEN the App is loaded or refreshed, THE App SHALL read all transactions from Storage and render them in the Transaction_List, Balance_Display, and Chart within 1 second of the page load event.
4. IF Local Storage is unavailable or returns a parse error, THEN THE App SHALL initialize with an empty transaction list, display an error message indicating that saved data could not be loaded, and continue operating normally without retrying the failed read.

---

### Requirement 6: Layout and File Structure

**User Story:** As a developer, I want the codebase to follow a clean and strict file structure so that the project remains maintainable and easy to navigate.

#### Acceptance Criteria

1. THE App SHALL be structured with exactly one HTML file at the root, exactly one CSS file inside the `css/` directory, and exactly one JavaScript file inside the `js/` directory.
2. THE App SHALL be fully functional as a standalone web page opened directly in the latest stable versions of Chrome, Firefox, Edge, and Safari without requiring a local development server.
3. THE App SHALL load and render its initial state within 3 seconds of the page being opened, and SHALL respond to UI interactions such as adding or deleting transactions within 200 milliseconds.
4. WHERE a charting library is used, THE App SHALL load it via a CDN `<script>` tag in the HTML file, without adding additional JavaScript files to the `js/` directory.

---

### Requirement 7: Browser Compatibility

**User Story:** As a user, I want the app to work consistently across modern browsers so that I can use it regardless of my browser preference.

#### Acceptance Criteria

1. THE App SHALL render and function correctly in the latest stable versions of Chrome, Firefox, Edge, and Safari, with all UI elements visible and all features operational.
2. THE App SHALL use only standard Web APIs (DOM manipulation, Local Storage, Fetch if needed) and SHALL NOT rely on browser-specific non-standard APIs.
3. IF a required standard Web API is unavailable in the user's browser, THEN THE App SHALL display an error message indicating that the browser is not supported and that the App cannot run.
