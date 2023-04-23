import {storage} from "/js/store.js";

export const trelloApi = {
    key: '6720f84eb76aac085d79c9d65b4c065e',
    authorized: async function() {
        let token = (await storage.get('token')).token;
        return !!token;
    },
    rest: async function(method, path, params={}) {
        var url = new URL("https://api.trello.com/1/" + path);
    
        params.key = trelloApi.key;
        params.token = (await storage.get('token')).token;
    
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.append(key, value);
        }
    
        const response = await fetch(url.href, { 
            method: method,
            headers: {
                "Accept": "application/json"
            } 
        });

        if (!response.ok) {
            console.log(response);
            throw new Error("An error occured during a REST call: " + response.status);
        }

        var output = await response.json();
        return output;
    },
    boards: {
        get: async function() {
            return trelloApi.rest('GET', 'members/me/boards');
        }
    },
    lists: {
        get: async function(boardId) {
            return trelloApi.rest('GET', 'boards/' + boardId + '/lists');
        }
    },
    logout: function() {
        return new Promise((resolve, reject) => {
            storage.remove('token').then(() => chrome.identity.clearAllCachedAuthTokens(() => { resolve() }));
        });
    },
    login: function() {
        var self = this;
        var redirectUri = chrome.identity.getRedirectURL();
    
        var authURL = new URL('https://trello.com/1/authorize');
        authURL.searchParams.append('return_url', redirectUri); 
        authURL.searchParams.append('callback_method', 'fragment'); 
        authURL.searchParams.append('scope', 'read,write'); 
        authURL.searchParams.append('expiration', 'never'); 
        authURL.searchParams.append('name', 'One-Click Trello'); 
        authURL.searchParams.append('key', '6720f84eb76aac085d79c9d65b4c065e'); 
        authURL.searchParams.append('response_type', 'token'); 
    
        console.log(authURL.href);
        
        return new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
                {
                    url: authURL.href,
                    interactive: true
                },
                function(data) {
                    console.log(data);
                    var token = new URL(data).hash.substr(7);
                    console.log("token: " + token);
                    storage.set({token: token}).then(resolve);
                }
            );
        });
    }
};