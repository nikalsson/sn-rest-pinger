/**
 * Script replicates the manual way of refreshing a
 * ServiceNow developer instance. I know, I'm lazy.
 */
 module.exports = async function () {
  const { DriverService } = require("selenium-webdriver/remote");
  let hibernating = true;

  // load dependencies
  require("dotenv").config();
  require("geckodriver");
  require("chromedriver");
  const {
    Builder,
    By,
    Key,
    until,
    WebElement
  } = require("selenium-webdriver");
  const chrome = require("selenium-webdriver/chrome");
  const firefox = require("selenium-webdriver/firefox");

  // Set default screen resolution (for headless instance)
  const screenResolution = {
    width: 1280,
    height: 720,
  };

  // Set config variables
  let webdriver = process.env.WEBDRIVER || "chrome";
  //let args = ["--disable-web-security"];
  let args = ["--headless ", "--disable-web-security"];

  let driver = await new Builder()
    .forBrowser(webdriver)
    .setChromeOptions(
      new chrome.Options()
      .headless()
      .addArguments(args)
      .windowSize(screenResolution)
      .excludeSwitches('enable-logging')
    )
    .setFirefoxOptions(
      new firefox.Options()
      .headless()
      .addArguments(args)
      .windowSize(screenResolution)
    )
    .build();

  // Refreshing of instance starts here.
  try {
    // Go to servicenow login page
    writeToLog(
      "Redirecting to https://developer.servicenow.com/ssologin.do?relayState=%2Fdev.do%23%21%2Fhome"
    );
    await driver.get(
      "https://developer.servicenow.com/ssologin.do?relayState=%2Fdev.do%23%21%2Fhome"
    );
    // enter username
    writeToLog("Setting username...");
    await driver
      .findElement(By.id("username"))
      .sendKeys(`${process.env.EMAIL}`);

    // click next
    writeToLog("Submit username...");
    await driver.findElement(By.id("usernameSubmitButton")).click();

    // enter password
    writeToLog("Waiting for password field to appear...");
    let pwd = driver.wait(until.elementLocated(By.id("password")), 5000);
    await driver
      .wait(until.elementIsVisible(pwd), 5000)
      .sendKeys(`${process.env.PASSWORD}`);

    // click sign in
    writeToLog("Find submit button");
    let signInBtn = driver.wait(
      until.elementLocated(By.id("submitButton")),
      5000
    );
    await driver.wait(until.elementIsVisible(signInBtn), 5000).click();
    writeToLog("Clicked submit button");

    // wait for 60 secs to ensure sign in is done
    writeToLog("Wait 30 secs for signing in");
    await driver.wait(
      // Title found from <head>
      until.titleIs("ServiceNow Developers", 60000)
      //until.urlIs("developer.servicenow.com/dev.do"), 30000
    );

    // Pause for a bit before trying to get the wakeup button
    writeToLog(
      "Pause for 10 secs before trying to find waking up instance text"
    );
    await new Promise((resolve) => setTimeout(resolve, 10000));

    try {
      // Check if the "Waking up instance is present"
      let wakingUp = driver.wait(
        until.elementLocated(
          By.js(
            'return document.querySelector("body > dps-app").shadowRoot.querySelector("div > main > dps-home-auth-quebec").shadowRoot.querySelector("div > section:nth-child(1) > div > dps-page-header > div:nth-child(2) > div > p")'
          )
        ),
        10000
      );

      // Wait until Waking up text disappears, up to 10 mins
      await driver.wait(until.stalenessOf(wakingUp), 600000);
    } catch (err) {
      writeToLog("ERROR wakingUp >>" + err);
    } finally {
      // The text might not be present, try to find the Start building button    
      writeToLog("Try to locate Start building button");
      try {
        let wakeInstanceBtn = driver.wait(
          // This spaghetti element selector is due to SN Developer page is filled with Shadow Root elements
          until.elementLocated(
            By.js(
              'return document.querySelector("body > dps-app").shadowRoot.querySelector("div > main > dps-home-auth-quebec").shadowRoot.querySelector("div > section:nth-child(1) > div > dps-page-header > div:nth-child(1) > button")'
            )
          ),
          30000
        );
        writeToLog("Waking your instance up!");
        await driver.wait(until.elementIsVisible(wakeInstanceBtn), 30000).click();
        writeToLog("Clicked wake instance button");
        hibernating = false;
      } catch (err) {
        writeToLog("ERROR wakeInstanceBtn >> " + err);
      }
    }
  } catch (err) {
    writeToLog("ERROR >> " + err);
  } 
  finally {
    // Wait 10 minutes before terminating Selenium
    setTimeout(async () => {
      await driver.quit();
    }, 600000);
    writeToLog("TERMINATING wakeUpInstance");
  }
  return hibernating;
};

function writeToLog(message) {
  console.log(new Date().toISOString().replace(/[TZ]/g, " ") + `- wakeUpInstance >>> ${message}`);
}