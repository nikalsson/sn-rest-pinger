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

let today = new Date().getDay(); // Used to test day for opening a new ticket
let instanceHibernating = false;

async function start() {
  writeToLog("START REST OPERATIONS, TRY FIRST TO GET AN EXISTING INC")
  try {
    let ticketInfo = await getInc();
    if (instanceHibernating) {
      writeToLog("HIBERNATING, WAITING TO START INSTANCE");
      instanceHibernating = await wakeUpInstance();
      start();
    } else if (ticketInfo.sys_id !== null && ticketInfo.number !== null) {
      writeToLog(`FOUND TICKET: ` + JSON.stringify(ticketInfo));
      updateTicket(ticketInfo.sys_id);
      return ticketInfo;
    }
  } catch (error) {
    writeToLog("ERROR start: " + error.message);
  }
}

async function getInc() {
  let ticketInfo = {
    sys_id: null,
    number: null,
  };
  try {
    const url =
      instanceURL +
      `api/now/table/incident?sysparm_query=active%3Dtrue%5Ecaller_id.user_name%3D${process.env.UNAME}^sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()&sysparm_limit=1`;
    const response = await axios.get(url, axiosHeadersObject);
    if (response.status == 200) {
      // Test the response if the instance is hibernating, if yes set instanceHibernating to true
      const hiberRegex = new RegExp(/<title>[\n\s]+Instance Hibernating page[\n\s]+<\/title>/);
      if (hiberRegex.test(response.data)) {
        writeToLog("INSTANCE IS HIBERNATING!");
        instanceHibernating = true;
        return ticketInfo;
      }

      instanceHibernating = false;

      // Check if the result is empty, would indicate that ticket is not found. Try to create a ticket
      if (response.data.result.length === 0) {
        writeToLog("A TICKET WAS NOT FOUND. TRY TO CREATE NEW ONE AND RE-TRY GET.");
        await createTicket();
        await wait(5000);
        writeToLog("WAIT OVER, TRY TO GET TICKET AGAIN");
        start();
      } else {
        ticketInfo = {
          sys_id: response.data.result[0].sys_id,
          number: response.data.result[0].number,
        };
      }
      return ticketInfo;
    } else if (response.status == 401) {
      writeToLog("GET NOT ALLOWED! CHECK YOUR USERNAME, PASSWORD AND PERMISSIONS!");
    } else {
      start();
    }
  } catch (error) {
    writeToLog("ERROR getInc: " + error.message);
    await wait(30000); // Wait 30 secs and try again
    start();
  }
}

async function createTicket() {
  let date = new Date().toString().substr(0, 24);
  let contentObj = {
    short_description: `${date} created for posting`,
    caller_id: auth.username,
  };
  try {
    const url = instanceURL + `api/now/table/incident`;
    const response = await axios.post(url, contentObj, axiosHeadersObject);
    writeToLog(`POST STATUS: ${response.status} - ${response.statusText}`);
    return response;
  } catch (error) {
    writeToLog("ERROR putToTicket: " + error.message);
    await wait(10000); // Wait 10 secs before continuing
  }
}

async function putToTicket(sys_id, contentObj) {
  try {
    const url = instanceURL + `api/now/table/incident/${sys_id}`;
    const response = await axios.put(url, contentObj, axiosHeadersObject);
    writeToLog(`PUT STATUS: ${response.status} - ${response.statusText}, WAIT 5 MINUTES TO SEND NEXT COMMENT`);
  } catch (error) {
    writeToLog("ERROR putToTicket: " + error.message);
    await wait(5000);
    start();
  }
}

async function updateTicket(sys_id) {
  try {
    let date = new Date();
    const minutesSinceLastGetReq = Math.round((date.valueOf() - lastPing.valueOf()) / 1000 / 60); // Get the difference in MS, convert to mins and round
    console.log("MINUTESSINCELASTREQ >> " + minutesSinceLastGetReq);
    // Check if the day has changed, if yes, reset the ticket info and create a new ticket to work with
    if (date.getDay() !== today) {
      writeToLog("DAY HAS CHANGED, START OPERATIONS AGAIN");
      today = new Date().getDay();
      instanceHibernating = false;
      start();
    } else if (minutesSinceLastGetReq > 14) {
      // Check if SN instance hasn't pinged back in 15 minutes. If not, suppose it's going to hiber and try to wake it.
      // Suspect the instance is hibering
      writeToLog("OVER 15 MINUTES PASSED SINCE SN REPLIED, LOG IN TO DEVELOPER PORTAL");
      instanceHibernating = await wakeUpInstance()
      start();
    }
    // Else keep commenting the ticket as usual
    const dateTimeStamp = date.toString().substr(0, 24);
    putToTicket(sys_id, {
      comments: `Tick Node.js ${dateTimeStamp}`,
    });
    setTimeout(() => {
      updateTicket(sys_id);
    }, 5 * 60 * 1000); // Tick every 5 minutes

  } catch (error) {
    writeToLog("ERROR updateTicket: " + error.message);
    start();
  }
}

// helper function to wait a set time
async function wait(timeMS) {
  await new Promise((resolve) => setTimeout(resolve, timeMS));
}

module.exports = {
  start: start,
  getInc: getInc,
  createTicket: createTicket,
  putToTicket: putToTicket,
  updateTicket: updateTicket,
};
