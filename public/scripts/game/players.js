'use strict';

require('styles/game/players');

var $ = require('jquery');

var CommonConsts = require('common/constants');
var CommonGame = require('common/game');

var App = require('ui/app');
var Cards = require('ui/cards');
var Chat = require('ui/chat');

var Util = require('util/util');

var Action = require('socket/action');

var State = require('game/state');

//HELPERS

var getPlayer = function(uid) {
	for (var idx = 0; idx < State.players.length; idx += 1) {
		var player = State.players[idx];
		if (player.uid == uid) {
			return player;
		}
	}
	console.error('Unable to find player', uid);
};

var roleClass = function(role) {
	var ac;
	if (CommonGame.isLiberal(role)) {
		ac = CommonConsts.LIBERAL;
	} else {
		ac = CommonConsts.FASCIST;
		if (CommonGame.isFuehrer(role)) {
			ac += ' hitler';
		}
	}
	return ac;
};

var displayAvatar = function(player, role) {
	var roleClassName = roleClass(role);
	player.roleClass = roleClassName;
	App.playerDiv(player, '.avatar').addClass(roleClassName);
};

var killPlayer = function(player, isFuehrer, quit) {
	if (!player.killed) {
		player.killed = true;
		App.playerDiv(player).removeClass('choose');
		App.playerDiv(player).addClass(State.finished ? 'quit' : 'killed');

		if (State.isLocal(player)) {
			Chat.toggleMute(!quit);
		}
		State.currentCount -= 1;

		if (!State.finished) {
			var Game = require('game/game');
			if (isFuehrer) {
				Game.end(true, quit ? 'hitler quit' : 'hitler');
			} else if (State.currentCount <= 2) {
				if (State.playerCount <= 3) {
					Game.end(false, quit ? 'quit' : 'killed');
				} else {
					Game.end(null, 'remaining');
				}
			}
		}
	}
};

var abandonedPlayer = function(data) {
	var player = getPlayer(data.uid);
	killPlayer(player, data.hitler, true);
	Chat.addAction('left the game', player);

	if (data.advance) {
		require('game/game').advanceTurn();
	}
};

//EVENTS

$('#players').on('click', '.player-slot.choose', function() {
	var targetUid = $(this).data('uid');
	if (State.presidentPower) {
		Action.emit(State.presidentPower, {uid: targetUid});
	} else {
		Action.emit('chancellor', {uid: targetUid});
	}
});

var chancellorChosen = function(data) {
	State.initializedPlay = true;
	$('.vote').hide();

	var president = getPlayer(data.president);
	var chancellor = getPlayer(data.chancellor);
	State.chancellorIndex = chancellor.index;

	$('.player-slot').removeClass('choose').removeClass('elect');
	App.playerDiv(president).addClass('elect');
	App.playerDiv(chancellor).addClass('elect');

	var directive, cards;
	if (State.localPlayer.killed) {
		directive = 'Waiting for vote';
		cards = null;
	} else {
		directive = 'Vote';
		cards = 'vote';
	}
	Chat.setDirective(directive + ' on President ' + Util.nameSpan(president) + ' and Chancellor ' + Util.nameSpan(chancellor));
	Cards.show(cards);
};

//PUBLIC

module.exports = {

	get: getPlayer,

	displayAvatar: displayAvatar,

	roleClass: roleClass,

	chancellorChosen: chancellorChosen,

	kill: killPlayer,

	abandoned: abandonedPlayer,

	revealRoles: function(roles) {
		roles.forEach(function(role, index) {
			displayAvatar(State.players[index], role);
		});
	},

};
