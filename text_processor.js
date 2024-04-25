const fs = require('fs');
const express = require('express')
const crypto = require('crypto')
const app = express()

app.use(express.json())

const send_team = require('./send_team');

const sendTeam = async (logtxt) => {
  const currentDate = new Date();
  fs.appendFile('log.txt', `${currentDate.toISOString().split('T')[0]}, ` + logtxt, function (err) {
    if (err) throw err;
  });
  await send_team.sendMessageToTeamChannel(logtxt);
};

app.post('/webhook-endpoint', (req, res) => {
  const response = req.body;
  const event = response["Event"];
  console.log(response);

  if (event) {
    if (event == "v2.test") {
      console.log("test mode");
    }
    if (event == "v2.sms.received") {
      const smsContent = response["Data"]["SmsContent"];
      console.log(smsContent);
      const logtxt = `${smsContent}\n`;
      sendTeam(logtxt);
    }
    res.status(200).send('OK');
  }
  else {
    res.status(400).send('Bad Request');
  }
})

app.listen(3000, () => console.log('Server is listening on port 3000!'))
