console.log('test');
var storage = chrome.storage.local;

var onAuthorize = function() {
    console.log("Authorized!")
};

chrome.browserAction.onClicked.addListener(function(tab) {
    if (!trelloApi.tryAuthorize()) {
        chrome.tabs.create({url: chrome.extension.getURL('settings.html')});
    } else {
        storage.get(['boardId', 'listId'], function(ret) {
            savedBoardId = ret.boardId;
            savedListId = ret.listId;

            chrome.tabs.getSelected(null, function(tab) {
                Trello.post('cards', {name: tab.title, urlSource: tab.url, idList: savedListId})
                console.log(tab);
                console.log('Create card?')
            });
        });
    }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

});


