const
	_ = require('lodash'),
	fetch = require('node-fetch');

/**
 * Fetch a user's data based on an API key
 * @param {string} apiKey
 */
function fetchUser(apiKey){
	return fetch(`https://derpibooru.org/api/v2/users/current.json?key=${apiKey}`)
		.then(r => r.json())
		.then(r => _.isObject(r) ? Promise.resolve(r) : Promise.reject());
}

/**
 * Make sure an API key is valid by requesting user data
 * @param {string} key
 * @returns {Promise<Object>}
 */
function checkApiKey(key){
	if (typeof key !== 'string' || !/^[A-Za-z\d]+$/.test(key))
		return Promise.reject();

	return new Promise(res => {
		fetchUser(key).then(response => {
			if (response !== false)
				res(response);
		});
	});
}

module.exports = { checkApiKey };
