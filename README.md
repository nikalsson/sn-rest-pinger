## ServiceNow wakeup app

- Aimed to keep ServiceNow developer instance from sleeping by running the app in Heroku
- The app keeps updating a ticket in ServiceNow and if the instance goes to sleep, attempts to wake up the instance with Selenium
- Also when the app is sending ticket updates to ServiceNow, the instance is set to ping back to keep the Heroku dyno from hibernating
- I only managed to get the app running in Heroku using Chrome for the webdriver, not Firefox - remember to set proper environment variables.
- Also for heroku set buildpacks since Node.js, Java, Chrome and Chromedriver are needed. I used:
  1. heroku/jvm
  2. heroku/nodejs
  3. https://github.com/heroku/heroku-buildpack-chromedriver.git
  4. https://github.com/heroku/heroku-buildpack-google-chrome.git