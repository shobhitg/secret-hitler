'use strict';

var DB = require.main.require('./server/tools/db');
var Utils = require.main.require('./server/tools/utils');

var Game = require.main.require('./server/play/game');
var Player = require.main.require('./server/play/player');

//LOCAL

var openNewGameFor = function(startSocket, options) {
	new Game(null, options, startSocket);
};

var joinGameById = function(socket, gid, isSpectator) {
	var oldGame = socket.game;
	if (!oldGame || oldGame.finished) {
		var game = Game.get(gid);

		if (game) {
			if (game.started) {
				game.addPlayer(socket, 'spectator');
				return true;
			}
			if (game.isFull()) {
				return 'full';
			}
			if (game.isOpen()) {
				game.addPlayer(socket, isSpectator);
				return true;
			}
		}
	}
	return false;
};

var joinOngoingGame = function(socket) {
	var oldGame = socket.game;

	var abandonedOldGame = socket && socket.game && socket.game.lastAction && socket.uid == socket.game.lastAction.uid && socket.game.lastAction.action == 'abandoned';

	if (oldGame && !oldGame.finished && !abandonedOldGame) {
		oldGame.addPlayer(socket);
		return true;
	}
};

var joinAvailableGame = function(socket) {
	var games = Game.games();
	for (var idx = 0; idx < games.length; idx += 1) {
		var game = games[idx];
		if (game.isOpenPublic()) {
			game.addPlayer(socket);
			return true;
		}
	}
	return false;
};

var leaveOldGame = function(socket) {
	var oldGame = socket.game;
	if (oldGame) {
		oldGame.disconnect(socket);
	}
};

//PUBLIC

module.exports = function(socket) {

	socket.on('lobby join', function(data, callback) {
		leaveOldGame(socket);
		Game.emitLobby(socket);

		if (!joinOngoingGame(socket)) {
			if (!data || !data.join || joinGameById(socket, data.join) == false) {
				socket.join('lobby');
			}
		}


	});

	socket.on('lobby afk', function(data, callback) {
		if (socket.game) {
			socket.game.resetAutostart();
		}
	});

	socket.on('room create', function(data, callback) {
		if (!Player.data(socket.uid, 'joining')) {
			leaveOldGame(socket);
			var gameMaxSize = Utils.rangeCheck(data.size, 5, 10, 10);

			var options = {
				size:         Utils.rangeCheck(data.size, 5, 10, 10),
				privateGame:  data.private,
				canViewVotes: data.canViewVotes
			}

			openNewGameFor(socket, options);
		}
	});

	socket.on('room quickjoin', function(data, callback) {
		var response = {};
		if (joinOngoingGame(socket)) {
			response.gid = socket.game.gid;
		} else {
			if (!Player.data(socket.uid, 'joining')) {
				response.success = true;
				if (!joinAvailableGame(socket)) {
					var options = {
						size: 10,
						privateGame: false
					}
					openNewGameFor(socket, options);
				}
			}
		}
		callback(response);
	});

	socket.on('room join', function(data, callback) {

		leaveOldGame(socket);
		Game.emitLobby(socket);

		var response = {};
		var gid = data.gid;
		if (!gid) {
			response.error = 'Invalid game code';
		} else {
			var joined = joinGameById(socket, data.gid);
			if (joined == 'full') {
				response.error = 'Game full';
			} else if (joined == 'started') {
				response.error = 'Game started';
			} else if (joined == true) {
				response.success = true;
			} else {
				response.error = 'Game not found';
			}
		}
		callback(response);
	});

	socket.on('change spectate', function(data, callback) {
		var game = Game.get(data.gid);
		game.editPlayer(socket, data.isSpectator);
		callback({});
	});

	socket.on('room spectate', function(data, callback) {

		Game.emitLobby(socket);

		var response = {};
		var gid = data.gid;
		if (!gid) {
			response.error = 'Invalid game code';
		} else {

			var joined = joinGameById(socket, data.gid, 'spectator');
			if (joined == 'full') {
				response.error = 'Game full';
			} else if (joined == 'started') {
				response.error = 'Game started';
			} else if (joined == true) {
				response.success = true;
			} else {
				response.error = 'Game not found';
			}
		}
		callback(response);
	});

	socket.on('feedback', function(data, callback) {
		var gid;
		if (socket.game) {
			gid = socket.game.gid;
		}
		DB.insert('feedback', {user_id: socket.uid, game_id: gid, username: socket.name, report_type: data.type, feedback: data.body}, null, callback);
	});

};
