// require components and assign to variables
require('dotenv').config();
const express = require('express'),
  app = express(),
  cors = require('cors'), // enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) so that your API is remotely testable by FCC
  axios = require('axios'), // axios for http requests
  wakeUpInstance = require('./lib/wakeUp.js'); // waking up the instance - set the wanted webdriver etc. here!

// configure the app
app.set('view engine', 'ejs');
app.use(cors({
  optionSuccessStatus: 200
})); // some legacy browsers choke on 204
app.use(express.urlencoded({
  extended: true
})); // Use express.urlencoded({extended: true}) to extract the body of a POST request
app.use(express.static('public')); // http://expressjs.com/en/starter/static-files.html

const auth = {
  'username': process.env.UNAME,
  'password': process.env.USERPASS
};
const axiosHeadersObject = {
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  auth: auth,
  json: true
};
const instanceURL = process.env.URL;
let ticket = '';
let instanceHibernating = false;

let today = new Date().getDay();

async function startOperations() {
  try {
    let ticketInfo = await getInc();
    if (instanceHibernating) {
      writeToLog("HIBERNATING, WAITING TO START INSTANCE");
      instanceHibernating = await wakeUpInstance();
      startOperations();
    } else if (ticketInfo.sys_id !== null && ticketInfo.number !== null) {
      writeToLog(`FOUND TICKET: ` + JSON.stringify(ticketInfo));
      updateTicket(ticketInfo.sys_id);
      ticket = ticketInfo;
      return ticket;
    }
  } catch (error) {
    writeToLog("ERROR startOperations: " + error.message);
  }
}

async function getInc() {
  let ticketInfo = {
    sys_id: null,
    number: null
  };
  try {
    const url = instanceURL + `api/now/table/incident?sysparm_query=active%3Dtrue%5Ecaller_id.user_name%3D${process.env.UNAME}^sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()&sysparm_limit=1`;
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

      writeToLog(`response.data.result.length === 0 ${response.data.result.length === 0}`);

      // Check if the result is empty, would indicate that ticket is not found. Try to create a ticket
      if (response.data.result.length === 0) {
        await createTicket();
        await wait(5000);
        writeToLog("WAIT OVER, TRY TO GET TICKET AGAIN");
        startOperations();
      } else {
        ticketInfo = {
          sys_id: response.data.result[0].sys_id,
          number: response.data.result[0].number
        };
      }
      return ticketInfo;

    } else {
      startOperations();
    }
  } catch (error) {
    writeToLog("ERROR getInc: " + error.message);
    await wait(30000); // Wait 30 secs and try again
    startOperations();
  }
}

async function createTicket() {
  let date = new Date().toString().substr(0, 24);
  let contentObj = {
    "short_description": `${date} created for posting`,
    "caller_id": auth.username
  }
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
    writeToLog(`PUT STATUS: ${response.status} - ${response.statusText}, WAIT MAX. 29 MINUTES FOR NEXT PUT MESSAGE`);
  } catch (error) {
    writeToLog("ERROR putToTicket: " + error.message);
    await wait(5000);
    startOperations();
  }
}

function updateTicket(sys_id) {
  try {
    let date = new Date();

    // Check if the day has changed, if yes, reset the ticket info and create a new ticket to work with
    if (date.getDay() !== today) {
      ticket = '';
      writeToLog("DAY HAS CHANGED, START OPERATIONS AGAIN");
      startOperations();
    } else {
      // Else keep commenting the ticket as usual
      date = date.toString().substr(0, 24);
      putToTicket(sys_id, {
        "comments": `Tick Node.js ${date}`
      });
      let random = Math.round(Math.random() * 29 * 1000 * 60); // tick max. every 29 minutes
      setTimeout(() => {
        writeToLog(`New tick, delayed ${Math.round(random / 1000 / 60)} minutes`);
        updateTicket(sys_id);
      }, random);
    }
  } catch (error) {
    writeToLog("ERROR updateTicket: " + error.message);
    startOperations();
  }
}


// serve the index page
app.get("/", async (req, res) => {
  writeToLog(ticket);
  let ticketnumber = 'PLACEHOLDER NUMBER';
  if (ticket.number) {
    ticketnumber = ticket.number;
  }
  res.render('index', {
    ticketNumber: ticketnumber
  });
});

// listen for requests :)
const listener = app.listen(process.env.PORT || 3030, () => {
  writeToLog('Your app is listening on port ' + listener.address().port);
});


startOperations();



function writeToLog(message) {
  console.log(new Date().toISOString().replace(/[TZ]/g, " >> ") + message);
}

// helper function to wait a set time
async function wait(timeMS) {
  await new Promise((resolve) => setTimeout(resolve, timeMS));
}