'use strict';

module.exports = {

	TESTING: process.env.NODE_ENV === 'development',

	uuid: function (length) {
		return Math.random().toString(36).substr(2, length || 16);
	},

	code: function () {
		return Math.floor(Math.random() * 900000) + 100000;
	},

	rangeCheck: function (number, min, max, defaultValue) {
		if (number == null) {
			return defaultValue;
		}
		if (number < min) {
			return min;
		}
		if (number > max) {
			return max;
		}
		return number;
	},

	//RANDOM

	rngInt: function (generator, span) {
		return Math.abs(generator.int32()) % span;
	},

	randomize: function (generator, array) {
		var result = [], swapIndex;
		var Utils = this;
		array.forEach(function (val, idx) {
			if (!idx) {
				result[0] = val;
			} else {
				swapIndex = Utils.rngInt(generator, idx + 1);
				result[idx] = result[swapIndex];
				result[swapIndex] = val;
			}
		});
		return result;
	},

};
