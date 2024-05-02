const https = require('https');
const fs = require('fs');
const express = require('express')
const crypto = require('crypto')
const app = express()

app.use(express.json())

const send_team = require('./send_team');
const subscription = require('./subscription');


const sendTeam = async (logtxt) => {
  const currentDate = new Date();
  fs.appendFile('log.txt', `${currentDate.toISOString().split('T')[0]}, ` + logtxt, function (err) {
    if (err) throw err;
  });
  await send_team.sendMessageToTeamChannel(logtxt, '2fa');
};


const sendEmails = async () => {
  const email = await subscription.getEmails();
  const subject = email.subject;
  const content = email.body.content;
  const preview = email.bodyPreview;
  const sender = email.sender.emailAddress.address;
  const receiver = email.toRecipients[0].emailAddress.address;

  const teamcontent = content.replace('<html><head>', '<html><head>' + `From: ${sender}<br>` + `To: ${receiver}<br>` + `Subject: ${subject}<br><br>`);
  const logcontent = `From: ${sender}\n` + `To: ${receiver}\n` + `Subject: ${subject}\n\n` + `Content: ${preview}`;
  console.log(logcontent);

  const currentDate = new Date();
  fs.appendFile('log.txt', `${currentDate.toISOString().split('T')[0]}\n` + logcontent + "\n\n\n", function (err) {
    if (err) throw err;
  });
  await send_team.sendMessageToTeamChannel(teamcontent, '2fa');
}


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


app.post('/email-webhook', (req, res) => {
  if (req.query.validationToken) {
    console.log("subscription validation");
    res.send(req.query.validationToken);
  }
  else {
    console.log("New email received");
    sendEmails();
    res.status(200).send('OK');
  }
})

const privateKey = fs.readFileSync('key.pem', 'utf8');
const certificate = fs.readFileSync('cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(3000, () => console.log('HTTPS Server running on port 3000'));
