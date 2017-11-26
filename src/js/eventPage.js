var createdCards = {};
var notificationMs = 4000;
var contextMenuId = "OSCTT";


var showError = function(notId, message) {
    var info = {
        title: "Unable to create card",
        message: message,
        iconUrl: "icons/icon256.png",
        type: "basic"
    };

    chrome.notifications.update(notId, info, function(wasUpdated) {
        if (!wasUpdated) {
            chrome.notifications.create(notId, info, function() {
                setTimeout(function() {chrome.notifications.clear(notId);}, notificationMs)
            });
        }
    })
};


var resetTimeout = function(notificationId, notificationTimeout) {
    clearTimeout(notificationTimeout);
    return setTimeout(function() {chrome.notifications.clear(notificationId);}, notificationMs)
};


var oneClickSendToTrello = function (tab, contextInfo) {
    // try to login, if not possible: open options page to login
    if (!trelloApi.tryAuthorize()) {
        chrome.runtime.openOptionsPage();
        return
    }

    storage.loadOptions(function(options) {
        if (!options.boardId || !options.listId) {
            // for some reason, boardId and listId was not set -> options page
            chrome.runtime.openOptionsPage();
            return
        }

        if (options.autoClose) {
            chrome.tabs.remove(tab.id, function(){});
        }

        if (options.showNotification) {
            var newNotification = {
                title: "Trello card created!",
                message: 'Created card "' + tab.title + '".',
                iconUrl: "icons/icon256.png",
                type: "basic"
            };

            var notificationPromise = new Promise(function(resolve, reject) {
                chrome.notifications.create(null, newNotification, function(notId) {
                    var notTimeout = resetTimeout(notId);
                    resolve(notId, notTimeout);
                });
            });
        }

        var newCard = {
            name: tab.title,
            urlSource: tab.url,
            idList: options.listId
        };

        // check contextInfo
        if (contextInfo.selectionText) {
            newCard.desc = contextInfo.selectionText;
        } else if (contextInfo.mediaType === 'image') {
            // todo: attach clicked image as attachment (needs a separate Trello api post)
        }

        Trello.post('cards', newCard, function(card) {
            // success
            if (!options.showNotification) {
                return
            }

            Trello.get('batch', {urls: ['/cards/' + card.id + '/board', '/cards/' + card.id + '/list']}, function(info) {
                var board = info[0][200], list = info[1][200];

                var updatedInfo = {
                    message: 'Created card "' + card.name + '" in board "' + board.name + '" on list "' + list.name + '".',
                    buttons: [
                        {title: 'Show card...', iconUrl: "icons/hand-o-right.png"},
                        {title: 'Delete card', iconUrl: "icons/trash.png"}
                    ]
                };

                notificationPromise.then(function(notId, notTimeout) {
                    createdCards[notId] = card;

                    // update "premature" notification"
                    chrome.notifications.update(notId, updatedInfo, function(wasUpdated) {
                        if (wasUpdated) {
                            resetTimeout(notId, notTimeout);
                        }
                    });
                });

            });
        }, function(response) {
            if (options.autoClose) {
                // try to recover the tab, only try it on the last session that was closed
                // otherwise it might restore an unrelated session
                chrome.sessions.getRecentlyClosed({maxResults: 1}, function (sessions) {
                    if (sessions.length > 0 && sessions[0].tab && sessions[0].tab.index === tab.index) {
                        chrome.sessions.restore(sessions[0].tab.sessionId);
                    }
                });
            }

            // error in card creation
            notificationPromise.then(function(notId, notTimeout) {
                resetTimeout(notId, notTimeout);
                showError(notId, (response.status !== 0 ? "Error: " + response.responseText : ""));
            });
        });
    });
};

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
    var card = createdCards[notificationId];

    if (card) {
        if (buttonIndex === 0) {
            chrome.tabs.create({url: card.url});
        } else if (buttonIndex === 1) {
            Trello.put('cards/' + card.id, {closed: true})
        }

        chrome.notifications.clear(notificationId);
    }
});


// handle extension button click
chrome.browserAction.onClicked.addListener(function(tab) {
    oneClickSendToTrello(tab);
});

// add context menu item
chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
        id: contextMenuId,
        title: "Send to Trello",
        contexts: ['all']}
    );
});

// listen to context menu
chrome.contextMenus.onClicked.addListener(function(info, tab) {
   if (info.menuItemId === contextMenuId) {
       oneClickSendToTrello(tab, info);
   }
});

// logout here if triggered in options menu
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!sender.tab) {
        // message is from extension
        if (request.deauthorize) {
            trelloApi.deauthorize();
            sendResponse({success: true})
        }
    }
});
