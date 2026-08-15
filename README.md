# gas-framework

A lightweight, modular framework for Google Apps Script (GAS) designed to decouple functionality, manage custom menus, and handle HTTP GET/POST requests efficiently.

## Features

- **Centralized Routing**: easily register GET and POST handlers with action-based dispatching.
- **Custom Menu Management**: register menu items from anywhere in your project and build them automatically in `onOpen`.
- **Sheet Utility**: read and manipulate Google Sheets data as objects (JSON-like) with built-in filtering, appending and upserting.
- **Unified Responses**: simple JSON response utility for Web App deployments.
- **Lifecycle Hooks**: register multiple `onOpen` callbacks without cluttering the global `onOpen` function.
- **Default Fallbacks**: register default handlers for unmatched routes.

## File Structure

- `src/AppBootstrap.js`: The core framework for routing and menu management.
- `src/Sheet.js`: Utility for object-oriented sheet data manipulation.
- `src/Response.js`: Helper for generating standardized JSON responses.
- `src/Default.js`: Configures default "Not Found" handlers.
- `src/appsscript.json`: Project manifest file.

## Installation

### Method 1: Using Clasp (Recommended)
If you use [clasp](https://github.com/google/clasp) for local development:

1.  Clone the repository:
    ```bash
    git clone https://github.com/aperture-day/GAS-Framework.git
    ```
2.  Copy the `src/` directory to your project:
    ```bash
    cp -r GAS-Framework/src/ your-project-dir/
    ```
3.  Push to Google Apps Script:
    ```bash
    cd your-project-dir
    clasp push
    ```

### Method 2: Manual Copy
Copy the files from the `src/` directory directly into your Google Apps Script editor.

### Method 3: Library (Script ID)
You can also add this framework as a Library to your GAS project:
1.  Click on **Libraries** + in the Apps Script editor.
2.  Enter the Script ID: `1nK3RY0oPBFjFIA2QEWQLSq1mjnf4-YTM6RPoIrUWfJb7t84PFh_f0VX6`
3.  Click **Look up** and select the latest version.
4.  Set the identifier to `GasFramework`.

Or add this in dependencies of appsscript.json:

```json
{
  "dependencies": {
    "libraries": [
      {
        "userSymbol": "GASFramework",
        "version": "0",
        "libraryId": "1nK3RY0oPBFjFIA2QEWQLSq1mjnf4-YTM6RPoIrUWfJb7t84PFh_f0VX6",
        "developmentMode": true
      }
    ]
  }
}
```

---

## Usage

### 1. Initializing Menu and Routes

In your main script file (e.g., `main.gs` or `Code.gs`), set up the entry points:

```javascript
// Add this to your main script file.
// If you use library, you can use GASFramework.AppBootstrap instead of AppBootstrap.
const { AppBootstrap, Response, Sheet, Table, Statistic } = GASFramework;

function onOpen() {
  AppBootstrap.runOnOpen('My Custom Menu');
}

function doGet(e) {
  return AppBootstrap.dispatchGet(e);
}

function doPost(e) {
  return AppBootstrap.dispatchPost(e);
}
```

### 2. Registering Menu Items

Register menu items from any file:

```javascript
AppBootstrap.registerMenuItem('Sync Data', 'syncDataFunction');

function syncDataFunction() {
  SpreadsheetApp.getUi().alert('Syncing data...');
}
```

### 3. Registering Routes for Web Apps

Register handlers for specific actions (triggered by `?action=myAction` in the URL). You can now pass options to automatically resolve sheets.

```javascript
// Basic route
AppBootstrap.registerGetRoute('getUser', function(e, sheet) {
  return Response.json({
    status: 'success',
    user: 'John Doe'
  });
});

// Route with automatic sheet resolution (by ID)
AppBootstrap.registerGetRoute('listItems', function(e, sheet) {
  const db = Sheet.load(sheet);
  return Response.json(db.all());
}, { sheetId: 123456789 });
```

### 4. Default Fallbacks

Handle requests when no action matches:

```javascript
AppBootstrap.registerDefaultGet(function(e) {
  return Response.json({ status: 'error', message: 'Unknown GET action' });
});
```

### 5. Working with Sheets

Use the `readSheet` utility to interact with data as objects:

```javascript
function processData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Data');
  const db = Sheet.load(sheet);
  
  // Get all rows
  const allRows = db.all();
  
  // Get headers
  const headers = db.header();
  
  // Filter for specific rows
  const activeUsers = db.byColumn('Status', 'Active');
  
  // Get specific columns only
  const summary = db.filter(['Name', 'Email']);
  
  // Append new data
  db.append({
    'Name': 'Jane Smith',
    'Status': 'Active'
  });

  const stats = Statistic.sheets();
  Logger.log(stats);
}
```

#### Upserting

`upsert` matches existing rows on a key column, updating them in place and
appending the rest. It returns how many rows it wrote.

```javascript
function syncUsers(users) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Data');
  const db = Sheet.load(sheet);

  const result = db.upsert(users, { key: 'Email' });
  Logger.log(result); // { inserted: 3, updated: 12 }
}
```

**An upsert writes only the columns present in the object you pass.** Any header
you leave out is untouched, so a sheet can mix generated columns with columns a
human types into:

```javascript
// 'Notes' is typed by a human. Never mentioning it is what protects it —
// no allowlist to keep in sync, and columns added later are safe by default.
db.upsert({ 'Email': 'jane@example.com', 'Status': 'Active' }, { key: 'Email' });
```

Clearing a cell is therefore explicit — pass the header with an empty value:

```javascript
db.upsert({ 'Email': 'jane@example.com', 'Status': '' }, { key: 'Email' });
```

Only cells whose value actually changes are written, so an upsert that finds
nothing new performs no writes. Updates are written as contiguous column runs
rather than whole rows, so formulas in untouched cells survive.

See [ADR-0001](docs/adr/0001-upsert-writes-only-present-keys.md) for why the
contract works this way.

### 6. Working with Statistic

Use the `statistic` utility to get the statistics of the spreadsheet.

```javascript
function getStatistics() {
  const stats = Statistic.sheets();
  Logger.log(stats);
}
```

## Tests

```bash
node test/Sheet.test.js
```

No dependencies and no test framework — the suite is a plain Node script that
stubs the Apps Script `Sheet` object and runs `src/Sheet.js` for real. It exits
non-zero on failure.

The upsert contract in [ADR-0001](docs/adr/0001-upsert-writes-only-present-keys.md)
is what these tests exist to protect. Because this library is consumed in
development mode, a push is live for every dependent immediately — there is no
version to pin against, so this suite is the only gate between a change and
everything using it. Run it before pushing.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
