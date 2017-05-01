'use strict';

require('styles/lobby/timeout');

var $ = require('jquery');

var Config = require('util/config');
var Util = require('util/util');

var Socket = require('socket/socket');

var State = require('game/state');

//TIMERS

var lobbyInterval, socketInterval;
var inGameLobby;

var resetLobbyTimeout = function() {
	if (lobbyInterval) {
		clearInterval(lobbyInterval);
		lobbyInterval = null;
	}
	if (inGameLobby) {
		var waitDuration = Util.hidden('#lobby-wait-afk') ? 119 : 44;
		lobbyInterval = setTimeout(function() {
			if (Util.hidden('#lobby-wait')) {
				lobbyInterval = null;
				return;
			}
			$('#lobby-wait-afk').toggle();
			if (!Util.hidden('#lobby-wait-afk')) {
				Socket.emit('lobby afk');
				resetLobbyTimeout();
			} else {
				require('lobby/lobby').connectToStart();
				window.alert('You\'ve been taken back to the main lobby due to inactivity.');
			}
		}, waitDuration * 1000);
	}
};

var resetDisconnectTimeout = function() {
	if (socketInterval) {
		clearInterval(socketInterval);
		socketInterval = null;
	}
	socketInterval = setTimeout(function() {
		$('#disconnect-reason').text('Disconnected due to inactivity');
		$('#disconnect-description').text("Click anywhere to reload the page and see what you've missed");
		Socket.close();
	}, 10 * 60000);
};

var refreshTimers = function() {
	$('#lobby-wait-afk').hide();
	resetLobbyTimeout();
	resetDisconnectTimeout();
};

//EVENTS

$('#lobby-wait-afk').on('click', refreshTimers);

$('#overlay-disconnected').on('click', function() {
	window.location.reload();
});

$(window.document).on('click', refreshTimers);

$(window.document).on('keypress', refreshTimers);

//WINDOW

$(window).on('beforeunload', function() {
	if (!Config.TESTING && (State.started && !State.finished)) {
		return "You WILL NOT be removed from the game. If you'd like to leave permanently, please quit from the menu first so your fellow players know you will not return. Thank you!";
	}
});

$(window).on('focus', refreshTimers);

//PUBLIC

module.exports = {

	setGameLobby: function(waiting) {
		inGameLobby = waiting;
		refreshTimers();
	},

};
