/**
 * Sheet: A utility to handle reading and manipulating Google Sheets data as objects.
 */

/**
 * Reads a sheet and returns an object with methods to query and manipulate its data.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to read.
 * @returns {Object} An object containing methods: all, header, byColumn, filter, append.
 */
function readSheet(sheet) {
  var data = sheet.getDataRange().getValues();

  // 1. Separate headers from the rest of the rows
  var headers = data[0];
  var rows = data.slice(1);

  var headersIndex = {};
  headers.forEach(function (header, index) {
    headersIndex[header] = index;
  });

  return {
    /**
     * Returns all rows as objects where keys are headers.
     * @returns {Object[]}
     */
    all: function () {
      // 2. Map the rows to objects
      var result = rows.map(function (row) {
        var obj = {};
        // Loop through headers to create key-value pairs
        headers.forEach(function (header, index) {
          obj[header] = row[index];
        });
        return obj;
      });

      return result;
    },

    /**
     * Returns the header row.
     * @returns {string[]}
     */
    header: function () {
      return headers;
    },

    /**
     * Returns rows that match a specific column value.
     * @param {string} column - The column name to filter by.
     * @param {any} value - The value to match.
     * @returns {Object[]}
     */
    byColumn: function (column, value) {
      // Only return the rows that match the column value
      var result = rows.flatMap(function (row) {
        var obj = {};
        if (row[headersIndex[column]] == value) {
          headers.forEach(function (header, index) {
            obj[header] = row[index];
          });
          return obj;
        } else {
          return [];
        }
      });

      return result;
    },

    /**
     * Returns rows with only the specified columns.
     * @param {string[]} columns - The list of column names to include.
     * @returns {Object[]}
     */
    filter: function (columns) {
      // Only return the specified columns
      var result = rows.flatMap(function (row) {
        var obj = {};
        columns.forEach(function (column) {
          obj[column] = row[headersIndex[column]];
        });
        if (Object.keys(obj).length === 0) {
          return [];
        }
        return obj;
      });

      return result;
    },

    /**
     * Appends a new row to the sheet from an object.
     * @param {Object} data - The data object to append (keys should match headers).
     * @returns {Object} The appended data.
     */
    append: function (data) {
      var result = {};

      // convert object to array reference header order
      var rowData = headers.map(function (header) {
        result[header] = data[header];
        return data[header];
      });

      sheet.appendRow(rowData);

      return result;
    }
  }
}

