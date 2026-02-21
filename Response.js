/**
 * Response: A utility to handle the creation of JSON responses for Google Apps Script.
 */
const Response = (function () {
    return {
        /**
         * Creates a JSON TextOutput object.
         * @param {Object} data - The data to respond with.
         * @returns {ContentService.TextOutput}
         */
        json: function (data) {
            return ContentService
                .createTextOutput(JSON.stringify(data))
                .setMimeType(ContentService.MimeType.JSON);
        }
    }
})();

