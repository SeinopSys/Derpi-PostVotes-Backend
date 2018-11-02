const FastRateLimit = require('fast-ratelimit').FastRateLimit;

const options = {
	threshold: 10, // number of tokens
	ttl: 50, // seconds until counter reset
};
const votes = new FastRateLimit(options);


module.exports = { votes, options };
