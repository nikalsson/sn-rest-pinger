(async () => {
  const prompts = require('prompts')
  const fs = require('fs')

  let webdriverArray = {};
  webdriverArray[1] = 'chrome'
  webdriverArray[2] = 'firefox'

  const questions = [
    {
      type: 'number',
      name: 'webdriver',
      message: 'Select a default webdriver: \n[1] - Chrome\n[2] - Firefox (Geckodriver not included in package.json, remember to install it!)\n',
    },
    {
      type: 'text',
      name: 'email',
      message: `Enter your ServiceNow account's email address:`,
      initial: 'username@example.com'
    },
    {
      type: 'password',
      name: 'password',
      message: `Enter your ServiceNow account's email password:`,
      initial: '••••••'
    },
    {
      type: 'text',
      name: 'username',
      message: `Enter your ServiceNow REST integration account to update comments to INCs:`,
      initial: 'username'
    },
    {
      type: 'password',
      name: 'userpass',
      message: `Enter your ServiceNow REST integration account password`,
      initial: '••••••'
    },
    {
      type: 'text',
      name: 'instance_name',
      message: `Enter your ServiceNow developer instance name`,
      initial: 'dev10010'
    }
  ];

  const response = await prompts(questions);

  if (Object.keys(response).length === 6) {
    let str = `WEBDRIVER=${webdriverArray[response.webdriver]}\nEMAIL=${response.email}\nPASSWORD=${response.password}\nUNAME=${response.username}\nUSERPASS=${response.userpass}\nINSTANCENAME=${response.instance_name}`
    fs.writeFile('.env', str, (err) => {
      if (err)
        throw err;
      console.log('\nNew config has been saved!')
    })
  } else {
    console.log("\nNo config has been saved. Please re-run the setup and try again.")
  }
})();