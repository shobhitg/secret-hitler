'use strict';

var CommonUtil = require.main.require('./common/util');
var CommonValidate = require.main.require('./common/validate');

var Utils = require.main.require('./server/tools/utils');
var DB = require.main.require('./server/tools/db');
var Mailer = require.main.require('./server/tools/mailer');

var Lobby = require.main.require('./server/connect/lobby');

var Game = require.main.require('./server/play/game');
var Player = require.main.require('./server/play/player');

//LOCAL

var setSocket = function (socket, response, uid) {
	socket.uid = uid;
	socket.name = response.name;
	if (Player.add(uid, socket)) {
		Game.emitLobby();
	}

	DB.queryOne('UPDATE users SET online_at = ' + CommonUtil.now() + ', online_count = online_count + 1 WHERE id = ' + uid + ' RETURNING gid', null, function (user) {
		var oldGame = user.gid;
		if (oldGame) {
			Player.setGame(socket, Game.get(oldGame));
		}

		socket.emit('auth', response);

		Lobby(socket);
	});

};

var authenticate = function (socket, uid, auth) {
	DB.fetch('name, email', 'users', 'id = $1 AND auth_key = $2', [uid, auth], function (response) {
		if (response) {
			setSocket(socket, response, uid);
		} else {
			socket.emit('auth', { invalid: true });
		}
	});
};

//PUBLIC

module.exports = function (socket, uid, auth) {
	if (uid && auth) {
		authenticate(socket, uid, auth);
	}

	var returnForSignin = 'id, auth_key';

	socket.on('guest signin', function (data, callback) {
		if (!DB.exists) {
			var uid = Utils.code();
			var auth = Utils.uuid();
			var response = { id: uid, auth_key: auth };
			callback(response);
			response.name = 'Guest' + uid;
			response.email = response.name + '@secrethitler.com';
			setSocket(socket, response, uid);
			return;
		}

		DB.fetch('id, auth_key', 'users', 'online_count = $1 AND guest = $2', [0, true], function (userData) {
			var insertCallback = function (response) {
				authenticate(socket, response.id, response.auth_key);
				callback(response);
			};
			if (userData) {
				insertCallback(userData);
			} else {
				DB.count('users', function (guestNumber) {
					var authKey = Utils.uuid() + Utils.uuid();
					var userBegin = { guest: true, name: 'guest' + guestNumber, email: guestNumber + '@secrethitler.com', auth_key: authKey };
					DB.insert('users', userBegin, returnForSignin, insertCallback);
				});
			}
		});
	});

	socket.on('signin', function (data, callback) {
		authenticate(socket, data.uid, data.auth);
	});

	socket.on('signin email', function (data, callback) {
		var email = data.email;
		console.log('email', email);
		var errorMessage = CommonValidate.email(email);
		if (errorMessage) {
			console.log('email not valid', email);
			callback({ error: errorMessage });
			return;
		}

		var now = CommonUtil.now();
		DB.fetch('id, name, email, auth_key, passcode, passcode_time', 'users', 'email = $1', [email], function (userData) {
			if (userData) {
				var key = userData.passcode;
				if (key && now - userData.passcode_time > 60) {
					key = null;
				}
				console.log('key1', key);
				if (!key) {
					key = Utils.code();
					console.log('key2', key);
					DB.update('users', 'id = ' + userData.id, { passcode: key, passcode_time: now }, null, function () {
						console.log('userData', userData);
						Mailer.sendPasskey(userData.name, userData.email, key);
					});
				}
				callback({ signin: true, email: email });
			} else {
				callback({ register: true, email: email });
			}
		});
	});

	socket.on('signin passkey', function (data, callback) {
		var email = data.email;
		var passkey = data.pass;
		DB.fetch('id, name, auth_key', 'users', 'email = $1 AND passcode = $2', [email, passkey], function (userData) {
			if (userData) {
				var now = CommonUtil.now();
				if (now - userData.passcode_time > 1800) {
					callback({ error: 'Passkey expired. Please redo the process for a new key and try again.' });
				} else {
					DB.update('users', 'id = ' + userData.id, { passcode: null }, returnForSignin, function (response) {
						authenticate(socket, response.id, response.auth_key);
						callback(response);
					});
				}
			} else {
				callback({ error: 'Passkey incorrect' });
			}
		});
	});

	socket.on('signin name', function (data, callback) {
		var username = data.name;
		var email = data.email;

		var errorMessage = CommonValidate.username(username);
		if (errorMessage) {
			callback({ error: errorMessage });
			return;
		}
		errorMessage = CommonValidate.email(email);
		if (errorMessage) {
			callback({ error: errorMessage });
			return;
		}

		var completeRegistration = function (userData) {
			if (userData) {
				callback({ error: 'This ' + (userData.email == email ? 'email' : 'username') + ' has already been taken' });
			} else {
				var authKey = Utils.uuid() + Utils.uuid();
				var userBegin = { name: username, email: email, auth_key: authKey };
				DB.insert('users', userBegin, returnForSignin, function (response) {
					console.log('Registered', response.id, username, email);
					authenticate(socket, response.id, response.auth_key);
					callback(response);
				});
			}
		};

		var existingFields = 'name, email';
		DB.fetch(existingFields, 'users', 'name = $1 OR email = $2', [username, email], function (existingUser) {
			if (existingUser) {
				completeRegistration(existingUser);
			} else {
				DB.fetch(existingFields, 'users', 'name = $1', [CommonUtil.removeWhitespace(username)], function (existingUser) {
					completeRegistration(existingUser);
				});
			}
		});
	});

};
