console.log('test');

var onAuthorize = function() {
    console.log("Authorized!")
};

chrome.browserAction.onClicked.addListener(function(tab) {
    console.log('click');

    if (!Trello.authorized()) {
        Trello.setKey('6720f84eb76aac085d79c9d65b4c065e');
        Trello.authorize({
            interactive: false,
            success: onAuthorize
        });
    } else {
        // do cool stuff
        return
    }

    if (!Trello.authorized()) {
        chrome.tabs.create({url: chrome.extension.getURL('settings.html')});
    }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

});


