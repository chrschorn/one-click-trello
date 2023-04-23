import {trelloApi} from '/js/trelloapi.js';
import {storage} from '/js/store.js';


export async function oneClickSendToTrello(tab, contextInfo, withLink=true) {
    // try to login, if not possible: open options page to login
    if (!trelloApi.authorized()) {
        chrome.runtime.openOptionsPage();
        return;
    }

    const options = await storage.loadOptions();

    if (!options.boardId || !options.listId) {
        // for some reason, boardId and listId was not set -> options page
        chrome.runtime.openOptionsPage();
        return;
    }

    var newCard = {
        name: tab.title,
        urlSource: tab.url,
        idList: options.listId,
        pos: options.listPosition
    };

    // check contextInfo
    if (contextInfo && contextInfo.selectionText) {
        if (options.cardTitle == 'selectedText') {
            newCard.name = contextInfo.selectionText;
        } else {
            newCard.desc = contextInfo.selectionText;
        }
    }

    if (!withLink) {
        newCard.urlSource = null;
    }

    var card = trelloApi.rest('POST', 'cards', newCard);
    var notification = null;

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

        notification = createNotification(null, newNotification, card)
    }

    if (options.autoClose) {
        chrome.tabs.remove(tab.id, function(){});
    }

    card.then(function(card) {
        // success
        if (contextInfo && contextInfo.mediaType === 'image') {
            if (contextInfo.srcUrl.startsWith("http://") || contextInfo.srcUrl.startsWith("https://")) {
                trelloApi.rest('POST', 'cards/' + card.id + '/attachments', {url: contextInfo.srcUrl});
            }
        }

        if (!options.includeCover) {
            trelloApi.rest('DELETE', 'cards/' + card.id + '/attachments/' + card.idAttachmentCover)
        }
    }).catch(function(error) {
        console.log(error);

        let updatedContent = {
            title: "Failed to create card!",
            message: error.message,
            buttons: []
        };

        if (notification) {
            notification.then(notId => {
                chrome.notifications.update(notId, updatedContent);
            });
        } else {
            createNotification(null, updatedContent);
        }

        if (options.autoClose) {
            // try to recover the tab, only try it on the last session that was closed
            // otherwise it might restore an unrelated session
            chrome.sessions.getRecentlyClosed({maxResults: 1}, function (sessions) {
                if (sessions.length > 0 && sessions[0].tab && sessions[0].tab.index === tab.index) {
                    chrome.sessions.restore(sessions[0].tab.sessionId);
                }
            });
        }
    });
};

function createNotification(notificationId, options, cardPromise) {
    return new Promise((resolve, reject) => {
        chrome.notifications.create(notificationId, options, function(createdId) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            }

            var handler = function(id, buttonIndex, retries) {
                if(id != createdId) {
                    return;
                }

                cardPromise.then(card => {
                    if (buttonIndex === 0) {
                        chrome.tabs.create({url: card.url});
                        chrome.notifications.clear(id);
                    } else if (buttonIndex === 1) {
                        Trello.put('cards/' + card.id, {closed: true});
                        chrome.notifications.clear(id);
                    }
                });

                chrome.notifications.onButtonClicked.removeListener(handler);
            };

            chrome.notifications.onButtonClicked.addListener(handler);
            resolve(createdId);
        });
    });
};


export function getSelectionInfo(info, tab, callback) {
    chrome.scripting.executeScript({
        target: {tabId: tab.id}, 
        function: () => getSelection().toString()
    }, function(response) {
        var result = response[0].result;
        var selection = info.selectionText;

        if (!chrome.runtime.lastError && result.length > 0) {
            selection = result[0];
        }

        selection = info.selectionText.replace(/(\r\n|\n|\r)/gm, "\n\n");
        callback(selection);
    });
};