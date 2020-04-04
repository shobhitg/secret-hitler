'use strict';

module.exports = {

	LOCAL_DB_URL: process.env.DATABASE_URL || 'postgresql://postgres:hollas@127.0.0.1/secrethitler?connect_timeout=10&application_name=webapp',

	SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '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',

};
