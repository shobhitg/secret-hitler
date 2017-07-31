'use strict';

var CommonGame = require('common/game');

module.exports = {

	finished: true,

	getPresident: function() {
		return CommonGame.getParticipants(this.players, 'players')[this.presidentIndex];
	},

	getChancellor: function() {
		return CommonGame.getParticipants(this.players, 'players')[this.chancellorIndex];
	},

	isLocalPresident: function() {
		return CommonGame.getParticipants(this.players, 'players')[this.presidentIndex].index == this.localIndex;
	},

	isLocalChancellor: function() {
		return CommonGame.getParticipants(this.players, 'players')[this.chancellorIndex].index == this.localIndex;
	},

	localRoleName: function() {
		if (this.localRole == -1) {
			return 'Spectator';
		}
		return CommonGame.isLiberal(this.localRole) ? 'Liberal' : (CommonGame.isFuehrer(this.localRole) ? 'Hitler' : 'Fascist');
	},

	localPartyName: function() {
		return CommonGame.isLiberal(this.localRole) ? 'Liberal' : 'Fascist';
	},

	isLocal: function(player) {
		return this.localPlayer.uid == player.uid;
	},

	inGovernment: function() {
		return CommonGame.getParticipants(this.players, 'players')[this.presidentIndex].index == this.localIndex || CommonGame.getParticipants(this.players, 'players')[this.chancellorIndex].index == this.localIndex;
	},

};
