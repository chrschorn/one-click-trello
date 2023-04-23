var login = function() {
    chrome.runtime.sendMessage({type: 'login'}, function(response) {
        location.reload();
    });                             
};

var logout = function() {
    chrome.runtime.sendMessage({type: 'logout'}, function(response) {
        location.reload();
    });
};

var setOptions = function(payload) {
    chrome.runtime.sendMessage({type: 'setOptions', payload: payload});
};

var loadBoards = function (savedBoardId, savedListId) {
    chrome.runtime.sendMessage({type: 'getBoards'}, function(boards) {
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
    var $listSelect = $('#listSelect');
    $listSelect.prop('disabled', true);
    $listSelect.children('option').first().text('Loading...');

    var boardId = boardOption.data().id;

    chrome.runtime.sendMessage({type: 'getLists', boardId: boardId}, function(lists) {
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
    setOptions({
        boardId: $('#boardSelect').children('option:selected').first().data().id,
        listId: $('#listSelect').children('option:selected').first().data().id
    });
}

var init = function() {
    chrome.runtime.sendMessage({type: 'isLoggedIn'}, function(response) {
        console.log("isLoggedIn:", response);
        $('#optionsSection').toggle(response);
        $('#logoutSection').toggle(response);
        $('#loginSection').toggle(!response);
    });

    var $boardSelect = $('#boardSelect');
    var $listSelect = $('#listSelect');
    var $includeCover = $('#includeCoverImage');
    var $autoClose = $('#autoClose');
    var $showNotification = $('#showNotification');
    var $cardTitle = $('#cardTitle');
    var $listPosition = $('#listPosition');


    chrome.runtime.sendMessage({type: 'getOptions'}, function(options) {
        console.log("Options:", options);

        $listPosition.val(options.listPosition);
        $cardTitle.val(options.cardTitle);
        $includeCover.prop('checked', options.includeCover).prop('disabled', false);
        $autoClose.prop('checked', options.autoClose).prop('disabled', false);
        $showNotification.prop('checked', options.showNotification).prop('disabled', false);

        loadBoards(options.boardId, options.listId);
    });


    $('#login').click(login);
    $('#logout').click(logout);

    $boardSelect.change(function() {
        loadLists($("#boardSelect option:selected").first())
    });
    $listSelect.change(function() {
        saveChoice();
    });
    $includeCover.change(function() {
        setOptions({includeCover: $includeCover.is(":checked")});
    });
    $autoClose.change(function() {
        setOptions({autoClose: $autoClose.is(":checked")});
    });
    $showNotification.change(function() {
        setOptions({showNotification: $showNotification.is(":checked")});
    });
    $cardTitle.change(function() {
        setOptions({cardTitle: $cardTitle.val()});
    });
    $listPosition.change(function() {
        setOptions({listPosition: $listPosition.val()});
    })
};

$(document).ready(function() {
    init();
});
