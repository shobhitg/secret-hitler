'use strict';

var $ = require('jquery');

var CommonConsts = require('common/constants');
var CommonGame = require('common/game');

var Data = require('util/data');

var App = require('ui/app');
var Chat = require('ui/chat');
var Overlay = require('ui/overlay');

var Process = require('socket/process');

var Game = require('game/game');
var Players = require('game/players');
var Policies = require('game/policies');
var State = require('game/state');

var Socket = require('socket/socket');

//LOCAL

var startGame = function(data) {
	$('.chat-container').html('');
	$('#chat-box').show();
	$('.policy-placeholder.policy-revealed').html('');
	$('.tracker-slot').removeClass('danger');

	var currentPlayer = data.players.find(function(player) {
		return player.uid == Data.uid
	});

	Data.gameId = data.gid;
	Data.isSpectator = currentPlayer.isSpectator;

	App.showSection('game');

	State.inGame = true;
	State.started = true;
	State.initializedPlay = false;
	State.finished = false;
	State.positionIndex = data.startIndex;
	State.presidentIndex = State.positionIndex;
	State.chancellorIndex = null;
	State.players = data.players;
	State.playerCount = CommonGame.getParticipants(State.players,'players').length;
	State.currentCount = State.playerCount;
	State.canVeto = false;
	Chat.setEnacting(false);

	// Election tracker
	State.presidentPower = null;
	State.specialPresidentIndex = null;
	State.presidentElect = 0;
	State.chancellorElect = 0;
	State.electionTracker = -1;
	Game.advanceElectionTracker();

	// Policy deck
	State.enactedFascist = 0;
	State.enactedLiberal = 0;
	Policies.shuffle();

	var fascistPlaceholders = $('#board-fascist .policy-placeholder');
	for (var index = 0; index < CommonConsts.FASCIST_POLICIES_REQUIRED; ++index) {
		var fascistPower = CommonGame.getFascistPower(index + 1, State.playerCount);
		if (!fascistPower) {
			continue;
		}
		var placeholder = fascistPlaceholders.eq(index);
		var description = '';
		if (fascistPower.indexOf('veto') > -1) {
			description = 'Veto power is unlocked<br><br>';
		}
		if (fascistPower.indexOf('peek') > -1) {
			description += 'President examines the top 3 cards';
		} else if (fascistPower.indexOf('investigate') > -1) {
			description += 'President investigates a player\'s identity card';
		} else if (fascistPower.indexOf('election') > -1) {
			description += 'President picks the next presidential candidate';
		} else if (fascistPower.indexOf('bullet') > -1) {
			description += 'President must kill a player';
		}

		placeholder.data('power', fascistPower);
		placeholder.html('<div class="detail">' + description + '</div>');
	}

	// Display players
	var centerIndex = Math.ceil(State.playerCount / 2);

	var floatIndex = 0;

	var playerIndex = 0;

	var localPlayer = State.players.find(function(player) {
		return player.uid == Data.uid;
	});

	State.localPlayer = localPlayer;
	State.localIndex  = localPlayer.index;

	var players = State.players.filter(function(player) {
		return !player.isSpectator;
	})

	var sectionsString = "";
	if ((window.innerWidth || document.body.clientWidth) < 500) {
		sectionsString += fillPlayerSection(players, 0, players.length);
	} else {
		sectionsString += fillPlayerSection(players, 0, Math.ceil(players.length/2));
		sectionsString += fillPlayerSection(players, Math.ceil(players.length/2), undefined, 'bottom', function() {
			return (Math.floor(players.length / 2) % 2) ? '<div class="player-slot"></div>': '';
		});
	}


	$('#players').html(sectionsString);

	// Local player
	if (State.localPlayer) {
		State.localRole = State.localPlayer.role;
		$('#card-role .label').text(State.localRoleName());
		$('#card-party .label').text(State.localPartyName());
	} else {
		console.error('Local player not found');
	}

	// show spectator, otherwise show fascists and Hitler
	State.players.forEach(function(player) {
		var displayAvatar;
		if (State.localPlayer.role == -1) {
			displayAvatar = player.role == -1;
		} else {
			displayAvatar = player.role != null && player.role != -1;
		}

		if (displayAvatar && !player.isSpectator) {
			Players.displayAvatar(player, player.role);
		}
	});

	if (data.history) {
		Process.history(data.history);
	}

	var spectators = data.players.filter(function(player) {
		return player.isSpectator;
	})

	if (spectators.length) {
		spectators.forEach(function(uid) {
			Chat.addAction('is watching the game', uid);
		});
	}

	if (!State.initializedPlay) {
		Overlay.show('start');
		Game.playTurn();
		// Cards.show('role');
	} else if (State.initializedPlay && currentPlayer.isSpectator) {
		Overlay.show('start');

		var data = {};
		data.action = 'new spectator';
		Socket.emit('game action', data);
	}
};

var playerTemplate = function(player, playerIndex) {

	var name = player.name + ' ['+(playerIndex+1)+']';
	return '<div id="ps'+ player.uid +'" class="player-slot" data-uid="'+ player.uid +'">' +
				'<div class="avatar image">' +
					'<div class="vote" style="display:none;"></div>' +
				'</div>' +
				'<div class="contents">' +
					'<div class="title">' +
						'<h2>'+name+'</h2>' +
						'<span class="typing icon" style="display:none;">💬</span>' +
						'<span class="talking icon" style="display:none;">🎙</span>' +
					'</div>' +
					'<div class="chat"></div>' +
				'</div>' +
			'</div>';
}

var fillPlayerSection = function(players, start, end, cssClass, callback) {
	var playerIndex = start;
	var playerString = '<div class="player-section '+ cssClass +'">';
	if (callback) playerString += callback();
	players.slice(start, end).forEach(function(player) {
		playerString += playerTemplate(player, playerIndex);
		playerIndex++;
	});
	playerString += '</div>';
	return playerString;
}

//PUBLIC

module.exports = {

	play: startGame,

};
