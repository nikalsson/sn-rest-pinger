module.exports = async function () {
  const writeToLog = require("./writeToLog");

  const { spawn } = require("child_process");
  const child = spawn("java", ["-jar", "selenium-server/selenium-server-standalone-3.13.0.jar"]);

  child.stdout.on("data", (data) => {
    writeToLog(`SELENIUM OUT: ${data}`);
  });

  child.stderr.on("data", (data) => {
    writeToLog(`SELENIUM ERROR: ${data}`);
  });

  const { DriverService } = require("selenium-webdriver/remote");
  let hibernating = true;

  // load dependencies
  // require("geckodriver");
  require("dotenv").config();
  require("chromedriver");
  const { Builder, By, Key, until, WebElement } = require("selenium-webdriver");
  const chrome = require("selenium-webdriver/chrome");
  // const firefox = require("selenium-webdriver/firefox");

  // Set default screen resolution (for headless instance)
  const screenResolution = {
    width: 1280,
    height: 720,
  };

  // Set config variables
  let webdriver = process.env.WEBDRIVER || "chrome";
  let args = ["--headless", "--disable-web-security", "--disable-gpu", "--no-sandbox"];

  let driver = await new Builder()
    .forBrowser(webdriver)
    // WITH LOGGING TO CONSOLE .setChromeOptions(new chrome.Options().setChromeBinaryPath(process.env.CHROME_BIN).headless().addArguments(args).windowSize(screenResolution))
    .setChromeOptions(new chrome.Options().setChromeBinaryPath(process.env.CHROME_BIN).headless().addArguments(args).windowSize(screenResolution).excludeSwitches("enable-logging"))
    // .setFirefoxOptions(new firefox.Options().setBinary(`${process.env.FIREFOX_BIN}`).headless().addArguments(args).windowSize(screenResolution))
    .build();

  // Refreshing of instance starts here.
  try {
    // Go to servicenow login page
    writeToLog("wakeUpInstance: Redirecting to https://developer.servicenow.com/ssologin.do?relayState=%2Fdev.do%23%21%2Fhome");
    await driver.get("https://developer.servicenow.com/ssologin.do?relayState=%2Fdev.do%23%21%2Fhome");
    await driver.wait(until.titleIs("ServiceNow SignOn"), 300000);

    // enter username
    writeToLog("wakeUpInstance: Setting username...");
    await driver.findElement(By.id("username")).sendKeys(`${process.env.EMAIL}`);

    // click next
    writeToLog("wakeUpInstance: Submit username...");
    await driver.findElement(By.id("usernameSubmitButton")).click();

    // enter password
    writeToLog("wakeUpInstance: Waiting for password field to appear...");
    let pwd = driver.wait(until.elementLocated(By.id("password")), 5000);
    await driver.wait(until.elementIsVisible(pwd), 5000).sendKeys(`${process.env.PASSWORD}`);

    // click sign in
    writeToLog("wakeUpInstance: Find submit button");
    let signInBtn = driver.wait(until.elementLocated(By.id("submitButton")), 5000);
    await driver.wait(until.elementIsVisible(signInBtn), 5000).click();
    writeToLog("wakeUpInstance: Clicked submit button");

    // wait for 60 secs to ensure sign in is done
    writeToLog("wakeUpInstance: Wait 30 secs for signing in, then try to find ServiceNow Developers from the title");
    await driver.wait(until.titleContains("ServiceNow Developers"), 300000); // Title found from <head>

    // Here we can assume that the instance will be waking automatically after signing in. Still pause for a bit before trying to get the wakeup button.
    hibernating = false;
    writeToLog("wakeUpInstance: Pause for 10 secs before trying to find waking up instance text");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    try {
      writeToLog('wakeUpInstance: Check if the "Waking up instance is present" - This may take a while');
      let wakingUp = driver.wait(
        until.elementLocated(
          By.js(
            'return document.querySelector("body > dps-app").shadowRoot.querySelector("div > main > dps-home-auth-quebec").shadowRoot.querySelector("div > section:nth-child(1) > div > dps-page-header > div:nth-child(2) > div > p")'
          )
        ),
        10000
      );

      // Wait until Waking up text disappears, up to 2 mins
      await driver.wait(until.stalenessOf(wakingUp), 120000);
    } catch (err) {
      writeToLog("ERROR wakingUp >>" + err);
    } finally {
      // The text might not be present, try to find the Start building button
      writeToLog("wakeUpInstance: Try to locate Start building button");
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
        writeToLog("wakeUpInstance: Waking your instance up!");
        await driver.wait(until.elementIsVisible(wakeInstanceBtn), 30000).click();
        writeToLog("wakeUpInstance: Clicked wake instance button");
      } catch (err) {
        writeToLog("ERROR wakeInstanceBtn >> " + err);
      }
    }
  } catch (err) {
    writeToLog("wakeUpInstance: ERROR >> " + err);
  } finally {
    // Wait 4 minutes before terminating Selenium
    setTimeout(async () => {
      await driver.quit();
    }, 240000);
    writeToLog("wakeUpInstance: TERMINATING wakeUpInstance");
  }
  child.on("close", (code) => {
    writeToLog(`SELENIUM EXITED WITH CODE ${code}`);
  });

  child.kill("SIGTERM");
  return hibernating;
};
