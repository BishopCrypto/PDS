const twilio = require('twilio');

mySID = 'AC2911fe23b8c685c1d0c41077351cf991';
myToken = 'b9d7728dec69d63551f7e028eebd8ebb';
const client = new twilio(mySID, myToken);


function getMostRecentMessage(toNumber, callback) {
  client.messages.list({to: toNumber, limit: 20}) 
  .then(messages => {
    let mostRecentMessage = messages[0];
    callback(null, mostRecentMessage.body);
  })
  .catch(error => callback(error));
}


module.exports = {
  getMostRecentMessage: getMostRecentMessage
};
