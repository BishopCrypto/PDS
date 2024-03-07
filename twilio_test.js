const twilioHelper = require('./from_twilio');

myPhone = '14152604648';

twilioHelper.getMostRecentMessage(myPhone, (err, messageBody) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`The most recent message to ${myPhone} is: ${messageBody}`);
});

