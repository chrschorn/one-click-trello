var $listSelect, $boardSelect;
var contentLoaded = false;

var login = function() {
    if (!trelloApi.tryAuthorize()) {
        // couldn't authorize without prompt
        chrome.tabs.create({url: 'html/login.html'});
        window.close();
    }
};

var logout = function () {
    Trello.deauthorize();
    update_buttons();
    $('main').toggle(false);
};

var update_buttons = function() {
    var authorized = Trello.authorized();
    $('#login').toggle(!authorized);
    $('#logout').toggle(authorized);
};

var loadBoards = function (savedBoardId, savedListId) {
    Trello.members.get("me/boards", function(boards) {
        // success
        var $boardSelect = $('#boardSelect');
        $boardSelect.empty();
        $.each(boards, function(i, board) {
            if (board.id === savedBoardId) {
                $boardSelect.append(
                    $('<option>' + board.name + '</option>').prop('selected', true).data({id: board.id})
                );
            } else if (!board.closed) {
                $boardSelect.append(
                    $('<option>' + board.name + '</option>').data({id: board.id})
                );
            }
        });
        $boardSelect.prop('disabled', false);
        loadLists($("#boardSelect option:selected").first(), (savedBoardId == null ? null : savedListId) )
    });
};

var loadLists = function(boardOption, savedId) {
    $listSelect.prop('disabled', true);
    $listSelect.children('option').first().text('Loading...');

    var boardId = boardOption.data().id;

    Trello.boards.get(boardId + '/lists', function(lists) {
        // success
        var $listSelect = $('#listSelect');
        $listSelect.empty();
        $.each(lists, function(i, list) {
            if (list.id === savedId) {
                $listSelect.append(
                    $('<option>' + list.name + '</option>').prop('selected', true).data({id: list.id})
                );
            } else if (!list.closed) {
                $listSelect.append(
                    $('<option>' + list.name + '</option>').data({id: list.id})
                )
            }
        });
        $listSelect.prop('disabled', false);

        saveChoice();
    });

};

var saveChoice = function() {
    storage.set({
        boardId: $boardSelect.children('option:selected').first().data().id,
        listId: $listSelect.children('option:selected').first().data().id
    });

    if (contentLoaded) {
        // only show "saved" when data was actually changed by the user
        // saveChoice() is executed also every time the option menu is opened
        flashSavedText();
    }

    contentLoaded = true;
};

var flashSavedText = function() {
    $('#saved').stop().css('opacity', 1).fadeTo(1500, 0);
};

var init = function(savedOptions) {
    $('#login').click(login);
    $('#logout').click(logout);

    $boardSelect = $('#boardSelect');
    $listSelect = $('#listSelect');
    var $autoClose = $('#autoClose');
    var $showNotification = $('#showNotification');

    if (trelloApi.tryAuthorize()) {
        $boardSelect.change(function() {
            loadLists($("#boardSelect option:selected").first())
        });
        $listSelect.change(function() {
            saveChoice();
        });
        $autoClose.change(function() {
            storage.set({autoClose: $autoClose.is(":checked")});
            flashSavedText();
        });
        $showNotification.change(function() {
            storage.set({showNotification: $showNotification.is(":checked")});
            flashSavedText();
        });

        $autoClose.prop('checked', savedOptions.autoClose).prop('disabled', false);
        $showNotification.prop('checked', savedOptions.showNotification).prop('disabled', false);

        $('main').toggle(true);

        loadBoards(savedOptions.boardId, savedOptions.listId);
    }

    update_buttons();
};

$(document).ready(function() {
    storage.loadOptions(init);
});
