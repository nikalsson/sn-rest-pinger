// Not only writes to console, but also pushes to the log array, which is shown on the index page
module.exports = function writeToLog(message) {
  const logMsg =
    new Date().toISOString().replace(/[TZ]/g, " ") + " >> " + message;
  console.log(logMsg);
  logsArray.unshift(logMsg);
  if (logsArray.length > 10000) logsArray.pop(); // Keep the log from getting too big
};
