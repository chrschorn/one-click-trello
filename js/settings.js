var onAuthorize = function () {
    console.log('s');
};

var login = function() {
    if (Trello.authorized()) {
        return
    }

    Trello.setKey('6720f84eb76aac085d79c9d65b4c065e');

    Trello.authorize({
        interactive: false,
        success: onAuthorize
    });

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
        success: onAuthorize
    });

    toggle_buttons()
};

var logout = function () {
    Trello.deauthorize();
    toggle_buttons();
};

var toggle_buttons = function() {
    var authorized = Trello.authorized();
    $('#login').toggle(!authorized);
    $('#logout').toggle(authorized);
};

$(document).ready(function() {
    if (!Trello.authorized()) {
        login();
    }

    $('#login').click(login);
    $('#logout').click(logout);

    toggle_buttons();
});
