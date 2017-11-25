var lastCratedCard;
var NOTID = 'OCSTT';


var oneClickSendToTrello = function (selectionText) {
    storage.loadOptions(function(options) {
        if (!options.boardId || !options.listId) {
            chrome.runtime.openOptionsPage();
            return
        }

        var showError = function(message) {
            var info = {
                title: "Unable to create card",
                message: message,
                iconUrl: "icons/icon256.png",
                type: "basic"
            };

            chrome.notifications.update(NOTID, info, function(wasUpdated) {
                if (!wasUpdated) {
                    chrome.notifications.create(NOTID, info, function() {
                        setTimeout(function() {chrome.notifications.clear(NOTID);}, 3500)
                    });
                }
            })
        };

        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs) {
                showError("Could not find active tab.");
                return
            }
            var tab = tabs[0];

            if (options.autoClose) {
                chrome.tabs.remove(tab.id, function(){});
            }

            if (options.showNotification) {
                var newNotification = {
                    title: "Card created!",
                    message: "Title: " + tab.title,
                    iconUrl: "icons/icon256.png",
                    type: "basic"
                };

                chrome.notifications.create(NOTID, newNotification, function() {});
            }

            var newCard = {
                name: tab.title,
                urlSource: tab.url,
                idList: options.listId
            };

            if (selectionText) {
                newCard.desc = selectionText;
            }

            Trello.post('cards', newCard, function(card) {
                // success
                lastCratedCard = card;

                Trello.get('batch', {urls: ['/cards/' + card.id + '/board', '/cards/' + card.id + '/list']}, function(info) {
                    var board = info[0][200], list = info[1][200];

                    var updatedInfo = {
                        message: 'Created card "' + card.name + '" in board "' + board.name + '" on list "' + list.name + '".',
                        buttons: [
                            {title: 'Show card...', iconUrl: "icons/hand-o-right.png"},
                            {title: 'Delete card', iconUrl: "icons/trash.png"}
                        ]
                    };

                    // update "premature" notification"
                    chrome.notifications.update(NOTID, updatedInfo, function(wasUpdated) {
                        if (wasUpdated) {
                            setTimeout(function() {chrome.notifications.clear(NOTID);}, 4000)
                        }
                    });
                });
            }, function(response) {
                // error in card creation
                showError((response.status !== 0 ? "Error: " + response.responseText : ""));

                // try to recover the tab, only try it on the last session that was closed
                // otherwise it might restore an unrelated session
                chrome.sessions.getRecentlyClosed({maxResults: 1}, function(sessions) {
                    if (sessions.length > 0 && sessions[0].tab && sessions[0].tab.index === tab.index) {
                        chrome.sessions.restore(sessions[0].tab.sessionId);
                    }
                });
            });
        });
    });
};

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
    if (notificationId === NOTID) {
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
        oneClickSendToTrello()
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
       oneClickSendToTrello(info.selectionText)
   }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!sender.tab) {
        // message is from extension
        if (request.deauthorize) {
            trelloApi.deauthorize();
            sendResponse({success: true})
        }
    }
});
