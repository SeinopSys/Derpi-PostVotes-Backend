const
	fs = require('fs'),
	moment = require('moment-timezone'),
	SocketIO = require('socket.io'),
	express = require('express'),
	https = require('https'),
	cors = require('cors'),
	config = require('./config'),
	pkg = require('../package.json'),
	socketUsers = new WeakMap(),
	derpi = require('./derpi-api.js'),
	store = require('./store.js'),
	rateLimit = require('./rate-limit.js');

// Add timestamps to console
moment.locale('en');
moment.tz.add('Europe/Budapest|CET CEST|-10 -20|01010101010101010101010|1BWp0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|11e6');
moment.tz.setDefault('Europe/Budapest');
require('log-timestamp')(() => moment().format('YYYY-MM-DD HH:mm:ss.SSS') + ' | %s');

let app = express();

// CORS
app.use(cors({ origin: config.ORIGIN_REGEX }));

app.get('/', function(req, res) {
	res.sendStatus(403);
});

let server;
if (config.LOCALHOST === true){
	server = https.createServer({
		cert: fs.readFileSync(config.SSL_CERT),
		key: fs.readFileSync(config.SSL_KEY),
	}, app);
}
else {
	const DNSChallenge = require('le-challenge-cloudflare').create({
		email: config.LE_EMAIL,
		key: config.CF_KEY,
	});
	let glx = require('greenlock-express').create({
		version: 'draft-11',
		server: config.LE_SERVER,
		email: config.LE_EMAIL,
		agreeTos: true,
		communityMember: true,
		approveDomains: config.LE_DOMAINS,
		renewWithin: 1728000000,
		challenges: { 'dns-01': DNSChallenge },
		challengeType: 'dns-01',
		store: require('le-store-certbot').create({
			configDir: require('path').join(require('os').homedir(), 'acme', 'etc'),
			webrootPath: '/tmp/acme-challenges'
		})
	});
	server = https.createServer(glx.httpsOptions, glx.middleware(app));
}
server.listen(config.PORT, '0.0.0.0');
let io = SocketIO.listen(server);
io.origins(function(origin, callback) {
	if (!config.ORIGIN_REGEX.test(origin)){
		return callback('origin not allowed', false);
	}
	callback(null, true);
});

console.log(`[Socket.io] Server listening on port ${config.PORT}`);

io.on('connection', function(socket) {
	socket.on('auth', data => {
		derpi.checkApiKey(data.apiKey).then(user => {
			socketUsers.set(socket, { id: user.id });
			socket.emit('auth', { status: true, user, version: pkg.version });
		}).catch(() => {
			socket.emit('auth', { status: false });
		});
	});
	socket.on('get-scores', (data, resp) => {
		const user = socketUsers.get(socket);
		if (!user || !user.id)
			return;

		store.getScores(data.entities, user.id).then(resp);
	});
	socket.on('vote', data => {
		const user = socketUsers.get(socket);
		if (!user || !user.id)
			return;

		rateLimit.votes.consume(user.id)
			.then(() => {
				store.vote(user.id, data.type, data.id, data.direction).then(data => {

					if (rateLimit.votes.hasTokenSync(user.id) === false) {
						socket.emit('vote-limit-reached', { allowVotingIn: rateLimit.options.ttl });
					}
					io.sockets.emit('vote-cast', data);
				});
			})
			.catch(() => {
				socket.emit('rate-limit', rateLimit.options);
			});
	});
	socket.on('disconnect', () => {
		socketUsers.delete(socket);
	});
});
