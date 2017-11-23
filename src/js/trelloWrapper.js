var trelloApi = {
    key: '6720f84eb76aac085d79c9d65b4c065e',
    tryAuthorize: function() {
        if (!Trello.authorized()) {
            Trello.setKey(this.key);
            Trello.authorize({ interactive: false });
        }

        return Trello.authorized()
    },
    authorized: Trello.authorized,
    authorizePrompt: function(success) {
        Trello.setKey(this.key);
        Trello.authorize({
            type: 'redirect', // options: 'popup', 'redirect'
            name: 'One-click send to Trello',
            persist: true,
            interactive: true,
            scope: {
                read: true,
                write: true,
                account: false
            },
            expiration: 'never',
            success: success
        });
        return this.tryAuthorize();
    }
};