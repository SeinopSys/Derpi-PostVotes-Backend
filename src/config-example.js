module.exports = {
	PORT: 8443,

	ORIGIN_REGEX: /^https:\/\/((www.)?derpibooru|trixiebooru).org/,

	LE_SERVER: 'staging',
	LE_EMAIL: '',
	LE_DOMAINS: ['derpi-postvotes.lc'],
	CF_KEY: '',

	// For development only
	LOCALHOST: true,
	SSL_CERT: '/path/to/ssl.crt',
	SSL_KEY: '/path/to/ssl.key',
};
