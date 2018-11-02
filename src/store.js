const
	_ = require('lodash'),
	Datastore = require('nedb'),
	db = {
		/* userId, type, id, value */
		votes: new Datastore({ filename: 'db/votes.txt', autoload: true }),
		/* type, id, score */
		scores: new Datastore({ filename: 'db/scores.txt', autoload: true }),
	},
	fiveMinutesInMs = 3e5,
	supportedEntityTypes = ['comment', 'post'];

_.forEach(db, v => {
	v.persistence.setAutocompactionInterval(fiveMinutesInMs);
});

/**
 * Calculates the score for an entity based on votes
 * @param {string} type
 * @param {number} id
 * @return {Promise<number>}
 */
function calcScore(type, id) {
	return new Promise((res, rej) => {
		db.votes.find({ type, id }, (err, docs) => {
			if (err) return rej(err);

			res(docs.reduce((a, doc) => a + doc.value, 0));
		});
	});
}

/**
 * Updates the score for an entity based on votes, and creates entry if missing
 * @param {string} type
 * @param {number} id
 * @return {Promise<number>}
 */
function updateScore(type, id) {
	return new Promise((res, rej) => {
		calcScore(type, id).then(score => {
			const queryObj = { type, id };
			db.scores.update(queryObj, { ...queryObj, score }, { upsert: true, returnUpdatedDocs: true }, (err, _, doc) => {
				if (err) return rej(err);

				res(doc);
			});
		});
	});
}

/**
 * Turns a votes data set into an indexed object
 * @param {Object[]} docs
 * @return {Object}
 */
function transformUserVotes(docs) {
	const userVotes = {};
	docs.forEach(doc => {
		userVotes[`${doc.type}_${doc.id}`] = doc.value > 0 ? 'up' : 'down';
	});
	return userVotes;
}

/**
 * Turns a votes data set into an indexed object
 * @param {Object[]} docs
 * @return {Object}
 */
function transformBroadcastVotes(docs) {
	const broadcastVotes = {};
	docs.forEach(doc => {
		if (broadcastVotes[`${doc.type}_${doc.id}`] === undefined)
			broadcastVotes[`${doc.type}_${doc.id}`] = {};
		const direction = doc.value === null ? null : doc.value > 0 ? 'up' : 'down';

		broadcastVotes[`${doc.type}_${doc.id}`] = { userId: doc.userId, direction };
	});
	return broadcastVotes;
}

/**
 * Turns a scores data set into an indexed object
 * @param {Object[]} docs
 * @return {Object}
 */
function transformScores(docs) {
	const scores = {};
	docs.forEach(doc => {
		scores[`${doc.type}_${doc.id}`] = doc.score;
	});
	return scores;
}

/**
 *
 * @param {number} userId
 * @param {string} type
 * @param {number} id
 */
function getUserVote(userId, type, id) {
	return new Promise((res, rej) => {
		db.votes.findOne({ userId, type, id }, (err, doc) => {
			if (err) return rej(err);

			res(doc);
		});
	});
}

/**
 *
 * @param {number} userId
 * @param {string} type
 * @param {number} id
 * @param {?string} direction
 */
function vote(userId, type, id, direction) {
	return new Promise((res, rej) => {
		getUserVote(userId, type, id).then(existingVote => {
			let value;
			switch (direction){
				case 'up':
					value = 1;
					break;
				case 'down':
					value = -1;
					break;
				default:
					if (!existingVote)
						return rej();
					value = null;
			}

			const next = (newVote) => {
				updateScore(type, id).then(newScores => {
					const scores = transformScores([newScores]);
					const userVotes = transformBroadcastVotes([newVote]);
					res({ scores, userVotes });
				});
			};
			if (existingVote){
				const queryObj = { userId, type, id };
				if (value === null)
					db.votes.remove(queryObj, err => {
						if (err) return rej();

						existingVote.value = null;
						next(existingVote);
					});
				else db.votes.update(queryObj, { ...queryObj, value }, err => {
					if (err) return rej();

					existingVote.value = value;
					next(existingVote);
				});
				return;
			}

			db.votes.insert({ userId, type, id, value }, (err, newVote) => {
				if (err) return rej();

				next(newVote);
			});
		});
	});
}

/**
 *
 * @param {object} entities {type: number[]}
 * @param {number} userId
 * @return {Promise<number>}
 */
function getScores(entities, userId) {
	return new Promise((res, rej) => {
		const query = { $or: [] };
		supportedEntityTypes.forEach(type => {
			if (_.isArray(entities[type]))
				query.$or.push({ type, id: { $in: entities[type] } });
		});
		if (query.$or.length === 0)
			return;
		db.scores.find(query, (err, docs) => {
			if (err) return rej(err);

			const scores = transformScores(docs);
			query.userId = userId;
			db.votes.find(query, (err, docs) => {
				if (err) return rej(err);
				const userVotes = transformUserVotes(docs);
				res({ scores, userVotes });
			});
		});
	});
}

module.exports = { vote, getScores };
