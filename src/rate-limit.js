const FastRateLimit = require('fast-ratelimit').FastRateLimit;
const config = require('./config');

const options = {
	threshold: config.RATE_LIMIT_THRESHOLD, // number of tokens
	ttl: config.RATE_LIMIT_TTL, // seconds until bucket reset
};
const votes = new FastRateLimit(options);

module.exports = { votes, options };
