/**
 * Sheet: A utility to handle reading and manipulating Google Sheets data as objects.
 */
const Sheet_ = (function () {

  /**
   * Compares a value already in the sheet with one about to be written.
   * @param {any} current - The value read from the sheet.
   * @param {any} next - The value to write.
   * @returns {boolean} True when writing would not change anything.
   */
  function isUnchanged(current, next) {
    if (current instanceof Date && next instanceof Date) {
      return current.getTime() === next.getTime();
    }
    return String(current) === String(next);
  }

  /**
   * Groups column indexes into contiguous runs, so each run can be written
   * with a single setValues call without touching the columns between them.
   * @param {number[]} columns - Column indexes, in any order.
   * @returns {number[][]} Runs of adjacent column indexes, ascending.
   */
  function contiguousRuns(columns) {
    var sorted = columns.slice().sort(function (a, b) {
      return a - b;
    });

    var runs = [];
    sorted.forEach(function (column) {
      var current = runs[runs.length - 1];
      if (current && column === current[current.length - 1] + 1) {
        current.push(column);
      } else {
        runs.push([column]);
      }
    });

    return runs;
  }

  return {
    /**
     * Reads a sheet and returns an object with methods to query and manipulate its data.
     * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to read.
     * @returns {Object} An object containing methods: all, header, byColumn, filter, append, upsert.
     */
    load: function (sheet) {
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

          // Keep the in-memory snapshot in step with the sheet, so a later
          // all() or upsert() sees the row we just wrote.
          rows.push(rowData);

          return result;
        },

        /**
         * Inserts or updates rows, matching existing rows on a key column.
         *
         * Only the columns present as keys on each data object are written. A
         * header missing from the object is left exactly as it is, which is
         * what makes this safe to run against a sheet that also holds
         * human-authored columns: to protect a column, simply don't mention it.
         * Clearing a cell is therefore explicit — pass the header with an
         * empty value.
         *
         * Only cells whose value actually changes are written, so re-running an
         * upsert that changes nothing performs no writes at all.
         *
         * @param {Object|Object[]} data - The data object(s) (keys should match headers).
         * @param {Object} options - Settings.
         * @param {string} options.key - Header name used to match existing rows.
         * @returns {{inserted: number, updated: number}} How many rows were written.
         */
        upsert: function (data, options) {
          var items = Array.isArray(data) ? data : [data];
          var key = options && options.key;

          if (!key) {
            throw new Error('Sheet.upsert requires options.key');
          }
          if (!(key in headersIndex)) {
            throw new Error('Sheet.upsert: key column "' + key + '" is not a header');
          }

          var keyColumn = headersIndex[key];

          // Where each key value currently lives, as an index into rows
          var rowIndexByKey = {};
          rows.forEach(function (row, index) {
            var value = row[keyColumn];
            if (value !== '' && value !== null && value !== undefined) {
              rowIndexByKey[value] = index;
            }
          });

          var pendingUpdates = [];
          var pendingInserts = [];
          var stagedInsertRows = {};

          items.forEach(function (item) {
            var keyValue = item[key];
            if (keyValue === '' || keyValue === null || keyValue === undefined) {
              throw new Error('Sheet.upsert: a row has no value for key column "' + key + '"');
            }

            // Columns this object actually speaks to. Everything else is left alone.
            var present = Object.keys(item).filter(function (header) {
              return header in headersIndex;
            });

            if (keyValue in rowIndexByKey) {
              var rowIndex = rowIndexByKey[keyValue];
              var row = rows[rowIndex];
              var changed = [];

              present.forEach(function (header) {
                var column = headersIndex[header];
                if (!isUnchanged(row[column], item[header])) {
                  row[column] = item[header];
                  changed.push(column);
                }
              });

              // A row staged for insert earlier in this same batch is already
              // going to be written in full; mutating it is enough.
              if (changed.length > 0 && !(rowIndex in stagedInsertRows)) {
                pendingUpdates.push({ rowIndex: rowIndex, columns: changed });
              }
              return;
            }

            // A new row: fill in the columns we were given, blank the rest
            var newRow = headers.map(function () {
              return '';
            });
            present.forEach(function (header) {
              newRow[headersIndex[header]] = item[header];
            });

            // Register it before appending, so a repeated key within the same
            // batch updates the row we just staged rather than inserting twice.
            rowIndexByKey[keyValue] = rows.length;
            stagedInsertRows[rows.length] = true;
            rows.push(newRow);
            pendingInserts.push(newRow);
          });

          // Write each changed row as contiguous column runs. Rewriting a whole
          // row would replace any formula in an untouched cell with its value.
          pendingUpdates.forEach(function (update) {
            var row = rows[update.rowIndex];
            contiguousRuns(update.columns).forEach(function (run) {
              var values = run.map(function (column) {
                return row[column];
              });
              sheet
                .getRange(update.rowIndex + 2, run[0] + 1, 1, run.length)
                .setValues([values]);
            });
          });

          // New rows are contiguous at the bottom, so they go in one call
          if (pendingInserts.length > 0) {
            var firstRow = rows.length - pendingInserts.length + 2;
            sheet
              .getRange(firstRow, 1, pendingInserts.length, headers.length)
              .setValues(pendingInserts);
          }

          return {
            inserted: pendingInserts.length,
            updated: pendingUpdates.length
          };
        },

        /**
         * Returns the statistics of the sheet.
         * @returns {Object} The statistics of the sheet.
         */
        statistic: function () {
          // Calculate the range containing data (last row x last column)
          var lastRow = sheet.getLastRow();
          var lastCol = sheet.getLastColumn();
          var totalDataCells = lastRow * lastCol;

          // Calculate the total cells created in this sheet (including empty rows/columns at the bottom)
          var maxRow = sheet.getMaxRows();
          var maxCol = sheet.getMaxColumns();
          var totalCreatedCells = maxRow * maxCol;

          return {
            rows: lastRow,
            cols: lastCol,
            maxRows: maxRow,
            maxCols: maxCol,
            totalDataCells: totalDataCells,
            totalCreatedCells: totalCreatedCells
          }
        }
      }
    }
  };
})();

/**
 * Expose Sheet globally if needed, though in GAS all files share the global scope.
 * This line is just for clarity.
 */
var Sheet = Sheet_;
