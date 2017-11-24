var lastCratedCard;

var oneclickSendToTrello = function () {
    storage.get(optionNames, function(ret) {
        options = ret;

        if (!options.boardId || !options.listId) {
            chrome.runtime.openOptionsPage();
            return
        }

        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs) {
                return
            }
            var tab = tabs[0];

            Trello.post('cards', {name: tab.title, urlSource: tab.url, idList: options.listId}, function(card) {
                // success
                var message = "Title: " + card.name;
                chrome.notifications.create('OCSTT', {title: "Card created!", message: message, iconUrl: "icon.png", type: "basic", buttons: [{title: 'Show card...'}, {title: 'Delete card'}]})
                lastCratedCard = card;
            });

            if (options.autoClose) {
                chrome.tabs.remove(tab.id, function(){});
            }

            console.log("Created card?");
        });
    });
};

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
    if (notificationId === 'OCSTT') {
        if (buttonIndex === 0) {
            chrome.tabs.create({url: lastCratedCard.url});
        } else if (buttonIndex === 1) {
            Trello.put('cards/' + lastCratedCard.id, {closed: true})
        }
        chrome.notifications.clear(notificationId);
    }
});

chrome.browserAction.onClicked.addListener(function(tab) {
    if (!trelloApi.tryAuthorize()) {
        chrome.runtime.openOptionsPage();
    } else {
        oneclickSendToTrello()
    }
});

chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
        id: "OCSTT",
        title: "Send to Trello"}
    );
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
   if (info.menuItemId === "OCSTT") {
       oneclickSendToTrello()
   }
});
