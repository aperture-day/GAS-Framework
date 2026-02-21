/**
 * AppBootstrap: A simple framework to manage GAS menu items and lifecycle hooks.
 */
const AppBootstrap = (function () {
    const store = {
        menuItems: [],
        onOpenHooks: [],
        getRoutes: {},
        postRoutes: {},
        defaultGetHandler: null,
        defaultPostHandler: null
    };


    /**
     * Helper to load sheet and optional table data based on options.
     */
    function loadContextFromOptions(req, options) {
        const db = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = null;

        // Determine the sheet
        if (options && options.sheetId) {
            // Unfortunately GAS doesn't have getSheetById directly on Spreadsheet, 
            // we have to iterate or use getSheets()[index] if we knew index.
            // But usually "sheetId" implies the integer ID (gid).
            // Let's assume options.sheetId is the Name for simplicity if ID lookup is hard, 
            // OR implement a finder. Let's assume user passes Sheet NAME if they want a specific one, 
            // or we implement a loop.
            // Actually, let's Stick to the requested: "sheet ID".
            // Use a helper to find by ID:
            const sheets = db.getSheets();
            for (let s of sheets) {
                if (s.getSheetId() == options.sheetId) {
                    sheet = s;
                    break;
                }
            }
        } else {
            // Default behavior: use 'table' param
            const tableName = req.parameter.table;
            if (tableName) {
                sheet = db.getSheetByName(tableName);
            }
        }

        if (!sheet) return { sheet: null };

        return { sheet: sheet };

        // if (!sheet) return { sheet: null };

        // let tableData = null;
        // if (options && options.loadTableData) {
        //     // Use the global readSheet function if available
        //     if (typeof readSheet !== 'undefined') {
        //         tableData = readSheet(sheet);
        //     }
        // }

        // return { sheet: sheet, tableData: tableData };
    }

    return {
        /**
         * Registers a menu item to be added to the custom menu.
         * @param {string} caption - The text to display in the menu.
         * @param {string} functionName - The global function name to call.
         */
        registerMenuItem: function (caption, functionName) {
            store.menuItems.push({ caption: caption, functionName: functionName });
        },

        /**
         * Registers a callback to be run during onOpen.
         * @param {Function} callback - The function to execute.
         */
        registerOnOpen: function (callback) {
            store.onOpenHooks.push(callback);
        },

        /**
         * Registers a handler for a specific GET action.
         * @param {string} action - The action name (req.parameter.action).
         * @param {Function} callback - The function to execute. (req, sheet, tableData) => ...
         * @param {Object} [options] - Optional settings.
         * @param {boolean} [options.loadTableData] - If true, reads table data.
         * @param {number} [options.sheetId] - If provided, targets this sheet ID.
         */
        registerGetRoute: function (action, callback, options) {
            store.getRoutes[action] = { callback: callback, options: options || {} };
        },

        /**
         * Registers a default handler for GET requests if no action matches.
         * @param {Function} callback - The function to execute.
         */
        registerDefaultGet: function (callback) {
            store.defaultGetHandler = callback; // Default handler usually does its own lookup
        },

        /**
         * Registers a handler for a specific POST action.
         * @param {string} action - The action name (req.parameter.action).
         * @param {Function} callback - The function to execute.
         */
        registerPostRoute: function (action, callback) {
            store.postRoutes[action] = callback;
        },

        /**
         * Registers a default handler for POST requests if no action matches.
         * @param {Function} callback - The function to execute.
         */
        registerDefaultPost: function (callback) {
            store.defaultPostHandler = callback;
        },

        /**
         * The main entry point for the onOpen trigger.
         * Should be called by the global onOpen function.
         * @param {string} menuName - The name of the custom menu (default: 'Start App').
         */
        runOnOpen: function (menuName = 'Start App') {
            const ui = SpreadsheetApp.getUi();
            const menu = ui.createMenu(menuName);

            // Add registered menu items
            store.menuItems.forEach(item => {
                menu.addItem(item.caption, item.functionName);
            });

            if (store.menuItems.length > 0) {
                menu.addToUi();
            }

            // Run separate onOpen hooks
            store.onOpenHooks.forEach(hook => {
                try {
                    hook();
                } catch (e) {
                    console.error('Error in onOpen hook:', e);
                }
            });
        },

        /**
         * Dispatches a GET request to the appropriate handler.
         * @param {Object} e - The event object.
         * @returns {ContentService.TextOutput}
         */
        dispatchGet: function (e) {
            const action = e.parameter.action;
            const route = store.getRoutes[action];

            if (route) {
                // Resolve context (sheet, tableData)
                const context = loadContextFromOptions(e, route.options);

                // If specific sheet was requested (via ID or table param) but not found, 
                // we might want to let the handler decide, or return error.
                // But user request implies we manage it.
                // However, some handlers might not need a sheet at all.
                // Let's pass what we found.
                return route.callback(e, context.sheet, context.tableData);
            } else if (store.defaultGetHandler) {
                return store.defaultGetHandler(e);
            } else {
                return Response.json({
                    status: 'error',
                    message: 'Action not found'
                });
            }
        },

        /**
         * Dispatches a POST request to the appropriate handler.
         * @param {Object} e - The event object.
         * @returns {ContentService.TextOutput}
         */
        dispatchPost: function (e) {
            const action = e.parameter.action;
            if (store.postRoutes[action]) {
                return store.postRoutes[action](e);
            } else if (store.defaultPostHandler) {
                return store.defaultPostHandler(e);
            } else {
                return Response.json({
                    status: 'error',
                    message: 'Action not found'
                });
            }
        }
    };
})();

/**
 * Expose AppBootstrap globally if needed, though in GAS all files share the global scope.
 * This line is just for clarity.
 */
// var AppBootstrap = AppBootstrap;
