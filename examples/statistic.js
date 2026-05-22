const { Statistic, AppBootstrap } = GASFramework;

function countAllSheetsCells() {
    const { totalDataCells, totalCreatedCells } = Statistic.sheets();

    const message = "【Workbook Cell Statistics】\\n" +
        "1. Total cells with data: " + totalDataCells.toLocaleString() + "\\n" +
        "2. Total created cells: " + totalCreatedCells.toLocaleString() + "\\n" +
        "* Note: The cell limit per Google Sheets file is 10 million.";

    Browser.msgBox(message);
}

if (AppBootstrap) {
    AppBootstrap.registerMenuItem('Workbook Cell Statistics', 'countAllSheetsCells');
}
