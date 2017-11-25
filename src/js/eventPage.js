var lastCratedCard;

var oneclickSendToTrello = function (selectionText) {
    storage.get(optionNames, function(ret) {
        var options = ret;

        if (!options.boardId || !options.listId) {
            chrome.runtime.openOptionsPage();
            return
        }

        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs) {
                return
            }
            var tab = tabs[0];
            var newCard = {
                name: tab.title,
                urlSource: tab.url,
                idList: options.listId
            };

            if (selectionText) {
                newCard.desc = selectionText;
            }

            var showNotification = function(card, boardName, listName) {
                var message = "Title: " + card.name;

                if (boardName && listName) {
                    message = 'Created card "' + card.name + '" on board "' + boardName + '" in list "' + listName + '".'
                }

                var newNotification = {
                    title: "Card created!",
                    message: message,
                    iconUrl: "icons/icon256.png",
                    type: "basic",
                    buttons: [
                        {title: 'Show card...', iconUrl: "icons/hand-o-right.png"},
                        {title: 'Delete card', iconUrl: "icons/trash.png"}
                    ]
                };

                chrome.notifications.create('OCSTT', newNotification, function() {
                    setTimeout(function() {chrome.notifications.clear('OCSTT');}, 3500)
                });

                if (options.autoClose) {
                    chrome.tabs.remove(tab.id, function(){});
                }
            };

            Trello.post('cards', newCard, function(card) {
                // success
                lastCratedCard = card;

                Trello.get('batch', {urls: ['/cards/' + card.id + '/board', '/cards/' + card.id + '/list']}, function(info) {
                    var boardReply = info[0][200], listReply = info[1][200];
                    showNotification(card, boardReply.name, listReply.name)
                }, function() {
                    showNotification(card);
                });

            });
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
        title: "Send to Trello",
        contexts: ['page', 'selection']}
    );
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
   if (info.menuItemId === "OCSTT") {
       oneclickSendToTrello(info.selectionText)
   }
});
