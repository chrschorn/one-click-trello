var $listSelect, $boardSelect;
var savedBoardId, savedListId;
var storage = chrome.storage.local;

var login = function() {
    if (!trelloApi.tryAuthorize()) {
        // couldn't authorize without prompt
        trelloApi.authorizePrompt(update_buttons);
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

var loadBoards = function (savedId) {
    Trello.members.get("me/boards", function(boards) {
        // success
        var $boardSelect = $('#boardSelect');
        $boardSelect.empty();
        $.each(boards, function(i, board) {
            if (board.id === savedId) {
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
        loadLists($("#boardSelect option:selected").first(), (savedId == null ? null : savedListId) )
    });
};

var loadLists = function(boardOption, savedId) {
    $listSelect.prop('disabled', true);
    $listSelect.children('option').first().text('Loading...');

    boardId = boardOption.data().id;

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

        if (savedId != null) {
            saveChoice();
        }
    });

};

var saveChoice = function() {
    savedBoardId = $boardSelect.children('option:selected').first().data().id;
    savedListId = $listSelect.children('option:selected').first().data().id;

    chrome.storage.local.set({boardId: savedBoardId, listId: savedListId});

    console.log(savedBoardId);
    console.log(savedListId);
};


var init = function() {
    $('#login').click(login);
    $('#logout').click(logout);

    $boardSelect = $('#boardSelect');
    $listSelect = $('#listSelect');

    if (trelloApi.tryAuthorize()) {
        $boardSelect.change(function() {
            loadLists($("#boardSelect option:selected").first())
        });
        $listSelect.change(function() {
            saveChoice();
        });
        $('main').toggle(true);

        loadBoards(savedBoardId);

    }
    update_buttons();
};

$(document).ready(function() {
    // try to recover saved items
    storage.get(['boardId', 'listId'], function(ret) {
        savedBoardId = ret.boardId;
        savedListId = ret.listId;

        init();
    });
});
