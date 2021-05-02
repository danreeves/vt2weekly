require("dotenv").config();
const { readFileSync } = require("fs");
const fetch = require("node-fetch");
const path = require("path");
const merry = require("merry");
const TimedCache = require("timed-cache");
const getTitleData = require("./authentication.js");
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
  let titleData = cache.get("titleData");
  if (!titleData) {
    titleData = await getTitleData();
    if (titleData.error) {
      context.log.error(`${data.status} - ${data.statusText}`);
      context.send(500, {
        error: true,
        message: "Couldn’t fetch data",
      });
      return;
    }
    console.log(JSON.stringify(titleData, null, 4));
    cache.put("titleData", titleData);
  }

  if (!titleData.live_events) {
    context.send(200, "There isn't one right now...");
    return;
  }

  let mutators = JSON.parse(titleData.live_events)[0].game_mode_data.mutators;

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
  return;
});

const API_ENDPOINT = "https://5107.playfabapi.com/Client/ExecuteCloudScript";
app.route("GET", "/cw", async function (request, response, context) {
  let titleData = cache.get("titleData");
  if (!titleData) {
    titleData = await getTitleData();
    if (titleData.error) {
      context.log.error(`${data.status} - ${data.statusText}`);
      context.send(500, {
        error: true,
        message: "Couldn’t fetch data",
      });
      return;
    }
    console.log(JSON.stringify(titleData, null, 4));
    cache.put("titleData", titleData);
  }

  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({
      FunctionName: "deusPlayerSetup",
      FunctionParameter: {},
    }),
    headers: {
      "Content-Type": "application/json",
      "X-Authorization": titleData.sessionTicket,
    },
  });

  const data = await res.json();
  const cycleData = data.data.FunctionResult.deus_journey_cycle_data;
  console.log(cycleData);
  const godCycle = ["nurgle", "tzeentch", "khorne", "slaanesh"];
  const journeyOrder = [
    "journey_ruin",
    "journey_cave",
    "journey_ice",
    "journey_citadel",
  ];
  const dominantGodIndex = (cycleData.cycle_count % godCycle.length) - 1;

  const journeys = journeyOrder.map((name, i) => {
    const index = (dominantGodIndex + i) % godCycle.length;
    return godCycle[index];
  });

  const output = journeys
    .map((god) => {
      const first = god.charAt(0).toUpperCase();
      const rest = god.slice(1);
      return first + rest;
    })
    .join(", ");

  context.send(200, output);
});

app.route("GET", "/robots.txt", function (request, response, context) {
  context.send(200, robotsTxt);
});

app.route("default", function (_, response) {
  response.writeHead(404).end();
});

app.listen(parseInt(process.env.PORT, 10) || 8080);
