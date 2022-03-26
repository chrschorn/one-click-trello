var createdCards = {};
var notificationMs = 4000;
var contextMenuId = "OSCTT";


var resetNotificationTimeout = function(notificationId, notificationTimeout) {
    clearTimeout(notificationTimeout);
    return setTimeout(function() {chrome.notifications.clear(notificationId);}, notificationMs)
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


var oneClickSendToTrello = function (tab, contextInfo, withLink=true) {
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

        if (!withLink) {
            newCard.urlSource = null;
        }

        var cardPromise = defer();

        if (options.showNotification) {
            var newNotification = {
                title: "Trello card created!",
                message: 'Created card "' + newCard.name + '".',
                iconUrl: "icons/icon256.png",
                type: "basic",
                buttons: [
                    {title: 'Show card...'},
                    {title: 'Delete card'}
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

            if (!options.includeCover) {
                Trello.delete('cards/' + card.id + '/attachments/' + card.idAttachmentCover);
            }

            cardPromise.resolve(card);
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
        title: "Send page to Trello",
        contexts: ["page", "frame", "link", "editable", "video", "audio", "browser_action", "page_action"]}
    );
    chrome.contextMenus.create({
        id: contextMenuId + "Selection",
        title: "Send selection+page to Trello",
        contexts: ["selection"]}
    );
    chrome.contextMenus.create({
        id: contextMenuId + "OnlySelection",
        title: "Send selection to Trello",
        contexts: ["selection"]}
    );
    chrome.contextMenus.create({
        id: contextMenuId + "Image",
        title: "Send image to Trello",
        contexts: ["image"]}
    );
});

getSelection = function(info, tab, callback) {
    chrome.tabs.executeScript(tab.id, {code: 'window.getSelection().toString()'}, function(result) {
        var selection = info.selectionText;

        if (!chrome.runtime.lastError && result[0].length > 0) {
            selection = result[0];
        }

        selection = info.selectionText.replace(/(\r\n|\n|\r)/gm, "\n\n");
        callback(selection);
    });
};


// listen to context menu
chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId == contextMenuId + "Selection") {
        getSelection(info, tab, function(selection) {
            info.selectionText = selection;
            oneClickSendToTrello(tab, info);
        });
    }
    else if (info.menuItemId == contextMenuId + "OnlySelection") {
        getSelection(info, tab, function(selection) {
            info.selectionText = selection;
            oneClickSendToTrello(tab, info, false);
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
