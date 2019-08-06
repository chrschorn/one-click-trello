var createdCards = {};
var notificationMs = 4000;
var contextMenuId = "OSCTT";


var resetNotificationTimeout = function(notificationId, notificationTimeout) {
    clearTimeout(notificationTimeout);
    return setTimeout(function() {chrome.notifications.clear(notificationId);}, notificationMs)
};


var updatePromisedNotification = function(notificationPromise, content) {
    // return a new promise, mainly passing the updated timeout to the resolve function
    return new Promise(function(resolve, reject) {
        notificationPromise.then(function(notInfo) {
            chrome.notifications.update(notInfo.id, content, function(wasUpdated) {
                if (wasUpdated) {
                    notInfo.timeout = resetNotificationTimeout(notInfo.id, notInfo.timeout);
                }
                resolve(notInfo);
            });
        });
    })
};


function defer() {
	var res, rej;

	var promise = new Promise((resolve, reject) => {
		res = resolve;
		rej = reject;
	});

	promise.resolve = res;
	promise.reject = rej;

	return promise;
}


var oneClickSendToTrello = function (tab, contextInfo) {
    // try to login, if not possible: open options page to login
    if (!trelloApi.tryAuthorize()) {
        chrome.runtime.openOptionsPage();
        return;
    }

    storage.loadOptions(function(options) {
        if (!options.boardId || !options.listId) {
            // for some reason, boardId and listId was not set -> options page
            chrome.runtime.openOptionsPage();
            return;
        }

        var newCard = {
            name: tab.title,
            urlSource: tab.url,
            idList: options.listId
        };

        if (options.autoClose) {
            chrome.tabs.remove(tab.id, function(){});
        }

        // check contextInfo
        if (contextInfo && contextInfo.selectionText) {
            if (options.selectionAsTitle) {
                newCard.name = contextInfo.selectionText;
            } else {
                newCard.desc = contextInfo.selectionText;
            }
        }

        var cardPromise = defer();

        if (options.showNotification) {
            var newNotification = {
                title: "Trello card created!",
                message: 'Created card "' + newCard.name + '".',
                iconUrl: "icons/icon256.png",
                type: "basic",
                buttons: [
                    {title: 'Show card...', iconUrl: "icons/hand-o-right.png"},
                    {title: 'Delete card', iconUrl: "icons/trash.png"}
                ]
            };

            chrome.notifications.create(null, newNotification, function(notId) {
                createdCards[notId] = cardPromise;
                resetNotificationTimeout(notId);

                // if card creation fails
                cardPromise.catch(function(errorText) {
                    chrome.notifications.update(notId, {
                        title: "Failed to create card!",
                        message: (errorText ? "Error: " + errorText : ""),
                        buttons: []
                    }, function() {
                        resetNotificationTimeout(notId);
                    });
                });
                
            });
        }

        Trello.post('cards', newCard, function(card) {
            // success
            if (contextInfo && contextInfo.mediaType === 'image') {
                if (contextInfo.srcUrl.startsWith("http://") || contextInfo.srcUrl.startsWith("https://")) {
                    Trello.post('cards/' + card.id + '/attachments', {url: contextInfo.srcUrl});
                }
            }

            if (options.showNotification) {
                cardPromise.resolve(card);
            }
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

            cardPromise.reject(response.responseText);
        });
    });
};


// listener for notification clicks
buttonListener = function(notificationId, buttonIndex, retries) {
    if (typeof(retries)==='undefined') retries = 0;

    var cardPromise = createdCards[notificationId].then(function(card) {
        if (buttonIndex === 0) {
            chrome.tabs.create({url: card.url});
            chrome.notifications.clear(notificationId);
        } else if (buttonIndex === 1) {
            Trello.put('cards/' + card.id, {closed: true});
            chrome.notifications.clear(notificationId);
        }
    }, () => {});   
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
        contexts: ["page", "frame", "link", "editable", "video", "audio", "browser_action", "page_action"]}
    );
    chrome.contextMenus.create({
        id: contextMenuId + "Selection",
        title: "Send selection to Trello",
        contexts: ["selection"]}
    );
    chrome.contextMenus.create({
        id: contextMenuId + "Image",
        title: "Send image to Trello",
        contexts: ["image"]}
    );
});


// listen to context menu
chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId == contextMenuId + "Selection") {
        chrome.tabs.executeScript(tab.id, {code: 'window.getSelection().toString()'}, function(result) {
            console.log("Error: " + chrome.runtime.lastError);
            if (!chrome.runtime.lastError && result[0].length > 0) {
                info.selectionText = result[0];
            }
            info.selectionText = info.selectionText.replace("\n", "\n\n");
            oneClickSendToTrello(tab, info);
        });
    } else if (info.menuItemId.startsWith(contextMenuId)) {
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
        } else if (request.selection) {
            oneClickSendToTrello()
        }
    }
});
