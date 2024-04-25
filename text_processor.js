const fs = require('fs');
const express = require('express')
const crypto = require('crypto')
const app = express()

app.use(express.json())

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
      fs.appendFile('log.txt', logtxt, function (err) {
        if (err) throw err;
      });
    }
    res.status(200).send('OK');
  }
  else {
    res.status(400).send('Bad Request');
  }
})

app.listen(3000, () => console.log('Server is listening on port 3000!'))
