# gas-framework

A lightweight, modular framework for Google Apps Script (GAS) designed to decouple functionality, manage custom menus, and handle HTTP GET/POST requests efficiently.

## Features

- **Centralized Routing**: easily register GET and POST handlers with action-based dispatching.
- **Custom Menu Management**: register menu items from anywhere in your project and build them automatically in `onOpen`.
- **Sheet Utility**: read and manipulate Google Sheets data as objects (JSON-like) with built-in filtering and appending.
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
const AppBootstrap = GASFramework.AppBootstrap;
const Response = GASFramework.Response;
const Sheet = GASFramework.Sheet;

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
}
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
