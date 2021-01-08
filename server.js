require("dotenv").config();
const { readFileSync } = require("fs");
const path = require("path");
const merry = require("merry");
const TimedCache = require("timed-cache");
const fetchWeekly = require("./fetchWeekly.js");
const localisations = require("./mutators.json");

const robotsTxt = readFileSync("./robots.txt", { encoding: "UTF-8" });

// 1 hour cache
const cache = new TimedCache({ defaultTtl: 3600 * 1000 });

const PROD = process.env.NODE_ENV === "production";

const app = merry();

app.route("GET", "/health-check", function (_, response) {
	response.writeHead(200).end();
});

app.route("GET", "/", async function (_request, _response, context) {
	let data = cache.get("weekly");
	if (!data) {
		data = await fetchWeekly();
		if (data.error) {
			context.log.error(`${data.status} - ${data.statusText}`);
			context.send(500, {
				error: true,
				message: "Couldn’t fetch data",
			});
			return;
		}
		cache.put("weekly", data);
	}
	let mutators = data[0].game_mode_data.mutators;

	let output =
		`It's ` +
		mutators
			.map((key) => localisations[key])
			.join(mutators.length === 2 ? " and " : ", ");

	let matches = output.match(new RegExp(", ", "g"));
	if (matches && matches.length > 1) {
		output = output.replace(new RegExp(", (?!.*, )", "g"), ", and ");
	}

	context.send(200, output);
});

app.route("GET", "/robots.txt", function (request, response, context) {
	context.send(200, robotsTxt);
});

app.route("default", function (_, response) {
	response.writeHead(404).end();
});

app.listen(parseInt(process.env.PORT, 10) || 8080);
