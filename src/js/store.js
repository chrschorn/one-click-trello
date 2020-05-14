var storage = {
    location: chrome.storage.local,
    optionNames: ['boardId', 'listId', 'autoClose', 'showNotification', 'selectionAsTitle', 'includeCover'],
    defaults: {autoClose: false, showNotification: true, selectionAsTitle: true, includeCover: true},
    set: function(obj, callback) {
        this.location.set(obj, callback);
    },
    loadOptions: function(callback) {
        var self = this;
        self.location.get(self.optionNames, function(storedOptions) {
            // set default values if no value exists (undefined)
            $.each(self.defaults, function(key, val) {
                if (storedOptions[key] === undefined) {
                    storedOptions[key] = self.defaults[key];
                }
            });

            self.set(storedOptions, function() {
                callback(storedOptions);
            });
        });
    }
};