// const express = require('express');
// const bodyParser = require('body-parser');

// const app = express();

// // Use body-parser middleware to handle incoming JSON
// app.use(bodyParser.json());

// app.post('/webhook', (req, res) => {
//   // Log the whole event to the console
//   console.log(req.body);

//   // Or access specific SMS values
//   let fromNumber = req.body.From;
//   let toNumber = req.body.To;
//   let messageBody = req.body.Body;
//   console.log(fromNumber, toNumber, messageBody);

//   res.status(200).end(); // Responding is important
// });

// app.listen(3000, () => {
//   console.log("Server is listening on port 3000");
// });


const twilioHelper = require('./from_twilio');

myPhone = '14152604648';

twilioHelper.getMostRecentMessage(myPhone, (err, messageBody) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`The most recent message to ${myPhone} is: ${messageBody}`);
});

