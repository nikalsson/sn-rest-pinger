const { response } = require("express");
const writeToLog = require("./writeToLog"),
  axios = require("axios"), // axios for http requests
  wakeUpInstance = require("./wakeUp"); // waking up the instance - set the wanted webdriver etc. here!

// If the instance is not defined, exit
if (!process.env.INSTANCENAME) {
  writeToLog("INSTANCE NOT KNOWN, EXITING!", logsArray);
  process.exit();
}

const instanceURL = `https://${process.env.INSTANCENAME}.service-now.com/`;
const auth = {
  username: process.env.UNAME,
  password: process.env.USERPASS,
};
const axiosHeadersObject = {
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  auth: auth,
  json: true,
};

// Declare some variables to keep track of the REST operations
let instanceHibernating = false;

async function start() {
  writeToLog("START REST OPERATIONS, TRY TO READ THE LAST MESSAGE FROM THE TABLE");
  try {
    instanceHibernating = await getLog();
    if (instanceHibernating) {
      writeToLog("HIBERNATING, WAITING TO START INSTANCE");
      instanceHibernating = await wakeUpInstance();
      await wait(300000); // Wait 5 mins
      start();
    } else {
      writeToLog(`INSTANCE NOT HIBERNATING, START SENDING POST MESSAGES`);
      createLogEntry();
    }
  } catch (error) {
    writeToLog("ERROR start: " + error.message);
  }
}

// Use a GET request to see if the instance is hibernating
async function getLog() {
  try {
    const url = instanceURL + `/api/now/table/x_442783_herokulog_logs?sysparm_query=ORDERBYDESCsys_created_on&sysparm_limit=1`;
    const response = await axios.get(url, axiosHeadersObject);
    if (response.status == 401) {
      writeToLog("GET NOT ALLOWED! CHECK YOUR USERNAME, PASSWORD AND PERMISSIONS!");
      return process.exit(1);
    } else if (response.status == 200 || response.status == 503) {
      // Test the response if the instance is hibernating, if yes set instanceHibernating to true
      const hiberRegex = new RegExp(/<title>[\n\s]+Instance Hibernating page[\n\s]+<\/title>/);
      if (hiberRegex.test(response.data) || response.status == 503) {
        writeToLog("INSTANCE IS HIBERNATING!");
        return true;
      }
      return false; // GET request went through and regex didn't notice instance hibernating
    } else {
      writeToLog(`GET STATUS: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    writeToLog("ERROR getLog: " + error.message);
    await wait(300000); // Wait 30 secs and try again
    start();
  }
}

async function createLogEntry() {
  try {
    let date = new Date();
    const minutesSinceLastGetReq = Math.round((date.valueOf() - lastPing.valueOf()) / 1000 / 60); // Get the difference in MS, convert to mins and round
    if (minutesSinceLastGetReq > 14) {
      writeToLog("OVER 15 MINUTES PASSED SINCE SN REPLIED, LOG IN TO DEVELOPER PORTAL");
      lastPing = new Date(); // Set lastPing to now and try to wake the instance
      instanceHibernating = await wakeUpInstance();
      await wait(300000); // Wait 5 mins
      start();
    } else {
      const logContent = logsArray.slice(0, 20).join('\n');  // Create the log ticket from last 20 log entries
      let contentObj = { log: logContent };
      const endPoint = instanceURL + `api/now/table/x_442783_herokulog_logs`;
      const response = await axios.post(endPoint, contentObj, axiosHeadersObject);
      writeToLog(`POST STATUS: ${response.status} - ${response.statusText}`);
      await wait(300000); // Tick every 5 minutes
      await createLogEntry();
    }
  } catch (error) {
    writeToLog("ERROR createLogEntry: " + error.message);
    await wait(10000); // Wait 10 secs before continuing
    start();
  }
}

// helper function to wait a set time
async function wait(timeMS) {
  await new Promise((resolve) => setTimeout(resolve, timeMS));
}

module.exports = {
  start: start,
  getLog: getLog,
  createLogEntry: createLogEntry,
};
