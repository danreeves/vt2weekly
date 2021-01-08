const fetch = require("node-fetch");
const TimedCache = require("timed-cache");
const getAuthorization = require("./authentication.js");

// 20 hour cache
const cache = new TimedCache({ defaultTtl: 20 * 3600 * 1000 });

const API_ENDPOINT = "https://5107.playfabapi.com/Client/ExecuteCloudScript";

module.exports = async function fetchWeekly() {
	const id = 1;
	let authorization = cache.get("authorization");
	if (!authorization) {
		authorization = await getAuthorization();
		// PlayFab sessions last 24 hours, this is 20 hours
		cache.put("authorization", authorization);
	}
	const response = await fetch(API_ENDPOINT, {
		method: "POST",
		body: JSON.stringify({
			FunctionName: "getLiveEvents",
			FunctionParameter: {
				id: id,
			},
		}),
		headers: {
			"Content-Type": "application/json",
			"X-Authorization": authorization,
		},
	});

	if (response.ok) {
		const data = await response.json();
		return JSON.parse(data.data.FunctionResult.live_events);
	}

	throw response;
};
