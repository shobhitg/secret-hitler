'use strict';

var Config = require.main.require('./server/tools/config');

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(Config.SENDGRID_API_KEY);

module.exports = {

	sendPasskey: function (name, email, passcode) {
		var appName = 'Secret Hitler Online';
		console.log('Mailing:', name, email, passcode);
		var msg = {
			to: email,
			from: process.env.SENDGRID_FROM_EMAIL || 'no-reply@secrethitler.blah',
			subject: `Secret Hitler OTP: ${passcode}`,
			text: ' ',
			html: `Your username is ${name} and your Secret Hitler OTP is ${passcode}`,
		};
		// passcodeMail.setSubstitutions({
		// 	':app': [appName, appName],
		// 	':name': [name],
		// 	':passcode': [passcode, passcode]
		// });
		// passcodeMail.setFilters({
		// 	'templates': {
		// 		'settings': {
		// 			'enable': 1,
		// 			'template_id': process.env.SENDGRID_EMAIL_TEMPLATE,
		// 		}
		// 	}
		// });

		sgMail
			.send(msg)
			.then(() => { }, console.error);



		// SendGrid.send(passcodeMail, function(err, json) {
		// 	if (err) {
		// 		console.error('sendPasskey', err);
		// 	}
		// });
	},

};
