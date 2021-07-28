// require components and assign to variables
require("dotenv").config();
const express = require("express"),
  app = express(),
  cors = require("cors"), // enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) so that your API is remotely testable by FCC
  RESToperations = require("./lib/RESTOperations"), // Functions that handle the communication with the instance
  writeToLog = require("./lib/writeToLog"); // Helper function for logging

// configure the app
app.set("view engine", "ejs");
app.use(cors({optionSuccessStatus: 200})); // some legacy browsers choke on 204
// app.use(express.urlencoded({extended: true})); // Use express.urlencoded({extended: true}) to extract the body of a POST request
app.use(express.static("public")); // http://expressjs.com/en/starter/static-files.html

global.logsArray = []; // Store logs to write them on the page instead of console, in a global object so RESToperations can write on the log
global.lastPing = new Date();

// serve the index page
app.get("/", async (req, res) => {
  res.render("index", {
    logsArray: logsArray,
  });
});

app.get("/sn_id", async (req, res) => {
  res.send("ACKNOWLEDGE")
  global.lastPing = new Date();
  writeToLog("GET REQUEST HIT, SET lastPing VARIABLE TO: " + global.lastPing);
});

// listen for requests :)
const listener = app.listen(process.env.PORT || 3030, () => {
  writeToLog("YOUR APP IS LISTENING ON PORT " + listener.address().port);
});

// Start by getting a ticket or waking up the instance
RESToperations.start();





