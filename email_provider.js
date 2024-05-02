const fs = require('fs');

const send_team = require('./send_team');
const subscription = require('./subscription');
const { start } = require('repl');

const sendEmails = async () => {
  const start_time = Date.now();
  const email = await subscription.getEmails();
  const date = email.createdDateTime;
  console.log("inbox msg", date);

  const data = fs.readFileSync('lastmsg.txt', 'utf8');
  console.log("saved msg", data);

  if (date == data) {
    console.log("No exist newly created email.");
    return;
  }

  console.log("Found new email.");
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

  fs.writeFileSync('lastmsg.txt', date);
  console.log("New email has been saved.");
  const end_time = Date.now();
  console.log((end_time-start_time) / 1000);
}


setInterval(() => {
  sendEmails();
}, 5000);
