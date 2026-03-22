/**
 * Table: A utility to handle reading and manipulating Google Table data as objects.
 */
const Table_ = function (table) {

  var headers = table[0];
  var rows = table.slice(1);

  var headersIndex = {};
  headers.forEach(function (header, index) {
    headersIndex[header] = index;
  });

  function toObject(row) {
    var obj = {};
    headers.forEach(function (header, index) {
      obj[header] = row[index];
    });
    return obj;
  }

  return {
    length: table.length,
    header: headers,
    /* convert the table to objects
     * @returns {Object[]} The converted rows.
     */
    toObjects: function () {
      return rows.map(toObject);
    },
    /* iterate over the rows
     * @param {function} callback - The callback function.
     */
    each: function (callback) {
      rows.forEach(function (row) {
        callback(toObject(row));
      });
    },
    groupBy: function (column) {
      var result = {};
      rows.forEach(function (row) {
        var key = row[headersIndex[column]];
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(toObject(row));
      });
      return result;
    }
  };
};

var Table = Table_;
