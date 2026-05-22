
function sheets() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var totalDataCells = 0;
  var totalCreatedCells = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];

    // Core Fix: If it's not a standard grid sheet (e.g., DATASOURCE connection sheet or OBJECT chart sheet), skip it
    if (sheet.getType() !== SpreadsheetApp.SheetType.GRID) {
      continue;
    }
    var info = Sheet.load(sheet).statistic();
    totalDataCells += info.totalDataCells;
    totalCreatedCells += info.totalCreatedCells;
  }

  return {
    totalDataCells: totalDataCells,
    totalCreatedCells: totalCreatedCells
  }

}

var Statistic = {
  sheets: sheets
}
