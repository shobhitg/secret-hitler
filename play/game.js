var DB = require.main.require('./tools/db');
var Utils = require.main.require('./tools/utils');
var SeedRandom = require('seedrandom');

var Player = require.main.require('./play/player');

var MINIMUM_GAME_SIZE = 5;

var LIBERAL = 'liberal';
var FASCIST = 'fascist';
var NONE = 'none';

var FASCIST_POLICIES_REQUIRED = 6;
var LIBERAL_POLICIES_REQUIRED = 5;

var games = [];

var Game = function(size) {
	this.gid = Utils.uid();
	this.maxSize = size;
	this.players = [];
	this.history = [];
	this.startIndex;

	this.generator = SeedRandom(this.gid);
	this.turn = {};
	this.enactedLiberal = 0;
	this.enactedFascist = 0;
	this.playerCount;
	this.currentCount;
	this.policyDeck;
	this.hitlerUid;

	this.positionIndex;
	this.specialPresident;
	this.presidentIndex;
	this.electionTracker = 0;

	var game = this;
	games.push(this);

	DB.insert('games', {id: this.gid});

//PRIVATE

	this.random = function(max) {
		return Utils.rngInt(this.generator, max);
	};

	this.shuffle = function(array) {
		return Utils.randomize(this.generator, array);
	};

	this.shufflePolicyDeck = function() {
		this.policyDeck = [];

		var cardsRemaining = 17 - this.enactedFascist - this.enactedLiberal;
		var liberalsRemaining = 6 - this.enactedLiberal;
		for (var i = 0; i < cardsRemaining; ++i) {
			this.policyDeck[i] = i < liberalsRemaining ? LIBERAL : FASCIST;
		}
		this.policyDeck = this.shuffle(this.policyDeck);
	};

//POLICIES

	this.peekPolicies = function() {
		return this.policyDeck.slice(0, 3);
	};

	this.getTopPolicies = function(count) {
		if (!count) {
			count = 3;
		}
		var policies = this.policyDeck.splice(0, count);
		if (this.policyDeck.length < 3) {
			this.shufflePolicyDeck();
		}
		return policies;
	};

	this.getTopPolicy = function() {
		return this.getTopPolicies(1)[0];
	};

//LOBBY

	this.emit = function(name, data) {
		io.to(this.gid).emit(name, data);
	};

	this.emitAction = function(name, data, secret) {
		data.action = name;
		if (this.finished) {
			var roles = [];
			this.players.forEach(function(uid, index) {
				var player = Player.get(uid);
				roles[index] = player.gameState.allegiance;
			});
			data.roles = roles;
		}
		if (secret) {
			var target = Player.get(secret.target);
			target.emitOthers('game action', data);
			data.secret = secret;
			target.emit('game action', data);
		} else {
			this.emit('game action', data);
		}
		return data;
	};

	this.gameData = function(perspectiveUid) {
		var sendHistory = this.history;
		var sendPlayers = [];
		var showFascists;
		if (perspectiveUid) {
			var perspectiveAllegiance = Player.get(perspectiveUid).gameState.allegiance;
			showFascists = perspectiveAllegiance == 1 || (perspectiveAllegiance == 2 && this.playerCount <= 6);
		}
		this.players.forEach(function(uid, index) {
			var player = Player.get(uid);
			var playerData = {
				uid: uid,
				name: player.name,
				index: index,
			};
			if (perspectiveUid) {
				var playerAllegiance = player.gameState.allegiance;
				if (perspectiveUid == uid || (showFascists && playerAllegiance > 0)) {
					playerData.allegiance = playerAllegiance;
				}
			}
			sendPlayers[index] = playerData;
		});
		return {
			gid: this.gid,
			started: this.started,
			maxSize: this.maxSize,
			startIndex: this.positionIndex,
			startTime: this.scheduledStart,

			players: sendPlayers,
			history: sendHistory,
		};
	};

	this.resetAutostart = function() {
		this.cancelAutostart();

		if (this.enoughToStart()) {
			var startDelay = 30;
			this.autoTimer = setTimeout(function() {
				game.start();
			}, startDelay * 1000);
			this.scheduledStart = Utils.now() + startDelay;
		}
	};

	this.cancelAutostart = function() {
		if (this.autoTimer) {
			clearTimeout(this.autoTimer);
			this.autoTimer = null;
			this.scheduledStart = null;
		}
	};

	this.start = function(socket) {
		this.cancelAutostart();
		this.started = true;
		this.playerCount = this.players.length;
		this.currentCount = this.playerCount;
		this.startIndex = this.random(this.playerCount);
		this.positionIndex = this.startIndex;
		this.presidentIndex = this.positionIndex;
		this.shufflePolicyDeck();

		var playerIdData = this.players.join(',');
		DB.update('games', "id = '"+this.gid+"'", {state: 1, started_at: Utils.now(), start_index: this.startIndex, player_count: this.playerCount, player_ids: playerIdData});

		// Assign Fascists
		var facistsCount = Math.ceil(this.playerCount / 2) - 1;
		var fascistIndicies = [2];
		for (var i = 1; i < this.playerCount; ++i) {
			fascistIndicies[i] = i < facistsCount ? 1 : 0;
		}
		fascistIndicies = this.shuffle(fascistIndicies);
		this.players.forEach(function(puid, pidx) {
			var player = Player.get(puid);
			var allegiance = fascistIndicies[pidx];
			player.gameState.allegiance = allegiance;
			if (allegiance == 2) {
				game.hitlerUid = puid;
			}
		});

		// Emit
		this.players.forEach(function(puid) {
			var player = Player.get(puid);
			player.emitStart();
		});
	};

	this.getFascistPower = function() {
		var enacted = this.enactedFascist;
		if (enacted == 1) {
			if (Utils.TESTING) {
				// return 'bullet'; //SAMPLE
			}
			return this.playerCount >= 9 ? 'investigate' : null;
		}
		if (enacted == 2) {
			return this.playerCount >= 7 ? 'investigate' : null;
		}
		if (enacted == 3) {
			return this.playerCount >= 7 ? 'election' : 'peek';
		}
		if (enacted == 4 || enacted == 5) {
			return 'bullet';
		}
	};

//STATE

	this.advanceTurn = function() {
		if (this.finished) {
			return;
		}
		this.turn = {};
		if (this.specialPresident != null) {
			this.presidentIndex = this.specialPresident;
			this.specialPresident = null;
		} else {
			for (var attempts = 0; attempts < this.playerCount; ++attempts) {
				++this.positionIndex;
				if (this.positionIndex >= this.playerCount) {
					this.positionIndex = 0;
				}
				var player = this.getPlayer(this.positionIndex);
				if (!player.gameState.killed) {
					break;
				}
			}
			this.presidentIndex = this.positionIndex;
		}
		this.power = null;
	};

	this.failedElection = function() {
		++this.electionTracker;
		var forced;
		if (this.electionTracker >= 3) {
			this.electionTracker = 0;
			this.presidentElect = null;
			this.chancellorElect = null;
			forced = this.getTopPolicy();
			this.enact(forced);
		}
		this.advanceTurn();
		return forced;
	};

	this.finish = function(liberals, method) {
		console.log('FIN', this.gid);
		this.finished = true;
		DB.update('games', "id = '"+this.gid+"'", {state: 2, finished_at: Utils.now(), history: JSON.stringify(this.history), enacted_liberal: this.enactedLiberal, enacted_fascist: this.enactedFascist, liberal_victory: liberals, win_method: method});
		this.removeSelf();
	};

	this.enact = function(policy) {
		this.electionTracker = 0;
		if (policy == LIBERAL) {
			++this.enactedLiberal;
			if (this.enactedLiberal >= LIBERAL_POLICIES_REQUIRED) {
				this.finish(true, 'policy');
				return;
			}
		} else {
			++this.enactedFascist;
			if (this.enactedFascist >= FASCIST_POLICIES_REQUIRED) {
				this.finish(false, 'policy');
				return;
			}
			this.power = this.getFascistPower();
		}
		if (!this.power) {
			this.advanceTurn();
		}
		return this.power;
	};

//PLAYERS

	this.addPlayer = function(socket) {
		socket.join(this.gid);

		var player = socket.player;
		player.game = this;
		player.disconnected = false;

		var adding = true;
		for (var pidx in this.players) {
			var gp = this.players[pidx];
			if (gp == player.uid) {
				adding = false;
				break;
			}
		}
		if (adding) {
			player.gameState = {};
			player.gameState.index = this.players.length;
			this.players[player.gameState.index] = player.uid;
		}

		if (this.started) {
			player.emitStart();
		} else if (this.isFull()) {
			this.start();
		} else {
			this.resetAutostart();
			this.emit('lobby game', this.gameData());
		}
	};

	this.kill = function(player) {
		if (!player.gameState.killed) {
			player.gameState.killed = true;
			--this.currentCount;
		}
	};

	this.removeSelf = function() {
		this.cancelAutostart();

		var gid = this.gid;
		games = games.filter(function(g) {
			return g.gid != gid;
		});
		if (!this.finished) {
			DB.query("DELETE FROM games WHERE id = '"+gid+"'");
		}
	};

	this.disconnect = function(socket) {
		if (!this.started || this.finished) {
			this.remove(socket);
			return;
		}
		var player = socket.player;
		if (player) {
			player.disconnected = true;
		}
	};

	this.remove = function(socket) {
		if (!this.started) {
			this.resetAutostart();
		}

		socket.leave(this.gid);

		var player = socket.player;
		if (player.gameState.left) {
			return false;
		}
		if (this.started) {
			player.gameState.left = true;
			this.kill(player);
		} else {
			this.players = this.players.filter(function(puid) {
				return puid != player.uid;
			});
			if (this.players.length == 0) {
				this.removeSelf();
			}
		}
		player.game = null;
		return true;
	};

//HELPERS

	this.getPlayer = function(index) {
		return Player.get(this.players[index]);
	};

	this.enoughToStart = function() {
		return this.players.length >= MINIMUM_GAME_SIZE;
	};

	this.isFull = function() {
		return this.players.length >= this.maxSize;
	};

	this.isOpen = function() {
		return !this.started && !this.isFull();
	};

	this.activeCount = function() {
		var count = 0;
		this.players.forEach(function(puid) {
			var player = Player.get(puid);
			if (!player.disconnected) {
				++count;
			}
		});
		return count;
	};

	this.canVeto = function() {
		return this.enactedFascist >= (Utils.TESTING ? 1 : FASCIST_POLICIES_REQUIRED - 1);
	};

	return this;
};

Game.games = function(argument) {
	return games;
};

module.exports = Game;
