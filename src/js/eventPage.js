var createdCards = {};
var notificationMs = 4000;
var contextMenuId = "OSCTT";


var resetTimeout = function(notificationId, notificationTimeout) {
    clearTimeout(notificationTimeout);
    return setTimeout(function() {chrome.notifications.clear(notificationId);}, notificationMs)
};


var updatePromisedNotification = function(notificationPromise, content) {
    // return a new promise, mainly passing the updated timeout to the resolve function
    return new Promise(function(resolve, reject) {
        notificationPromise.then(function(notInfo) {
            chrome.notifications.update(notInfo.id, content, function(wasUpdated) {
                if (wasUpdated) {
                    notInfo.timeout = resetTimeout(notInfo.id, notInfo.timeout);
                }
                resolve(notInfo);
            });
        });
    })
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
                type: "basic",
                buttons: [
                    {title: 'Show card...', iconUrl: "icons/hand-o-right.png"},
                    {title: 'Delete card', iconUrl: "icons/trash.png"}
                ]
            };

            var notificationPromise = new Promise(function(resolve, reject) {
                chrome.notifications.create(null, newNotification, function(notId) {
                    var notTimeout = resetTimeout(notId);
                    resolve({id: notId, timeout: notTimeout});
                });
            });
        }

        var newCard = {
            name: tab.title,
            urlSource: tab.url,
            idList: options.listId
        };

        // check contextInfo
        if (contextInfo) {
            if (contextInfo.selectionText) {
                newCard.desc = contextInfo.selectionText;
            } else if (contextInfo.mediaType === 'image') {
                // todo: attach clicked image as attachment (needs a separate Trello api post)
            }
        }

        Trello.post('cards', newCard, function(card) {
            // success
            if (!options.showNotification) {
                return
            }

            notificationPromise = notificationPromise.then(function(notInfo) {
                createdCards[notInfo.id] = card;
                return notInfo;
            });

            // any sort of update to the notification seems to destroy any button functionality under windows 10 native notifications, thus every update information is removed
            // // update early notification with buttons
            // notificationPromise = updatePromisedNotification(notificationPromise, {
            //     buttons: [
            //         {title: 'Show card...', iconUrl: "icons/hand-o-right.png"},
            //         {title: 'Delete card', iconUrl: "icons/trash.png"}
            //     ]
            // });
            //
            // Trello.get('batch', {urls: ['/cards/' + card.id + '/board', '/cards/' + card.id + '/list']}, function(info) {
            //     var board = info[0][200], list = info[1][200];
            //
            //     // update notification with exact board/list information
            //     notificationPromise = updatePromisedNotification(notificationPromise, {
            //         message: 'Created card "' + card.name + '" in board "' + board.name + '" on list "' + list.name + '".',
            //     });
            // });
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

            // notify of error in card creation
            notificationPromise = updatePromisedNotification(notificationPromise, {
                title: "Failed to create card!",
                message: (response.responseText ? "Error: " + response.responseText : ""),
                buttons: []
            });
        });
    });
};


// listener for notification clicks
buttonListener = function(notificationId, buttonIndex, retries) {
    if (typeof(retries)==='undefined') retries = 0;

    var card = createdCards[notificationId];

    if (card) {
        if (buttonIndex === 0) {
            chrome.tabs.create({url: card.url});
        } else if (buttonIndex === 1) {
            Trello.put('cards/' + card.id, {closed: true})
        }
        //setTimeout(function(){chrome.notifications.clear(notificationId)}, 500);
    } else if (retries < 3) {
        // card could still be processing since the button has to be displayed immediately with Win10 native notifications
        // retry after a few ms
        setTimeout(function(){buttonListener(notificationId, buttonIndex, retries+1)}, 500)
    }
};
chrome.notifications.onButtonClicked.addListener(buttonListener);


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

