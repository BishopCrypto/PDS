const { exec } = require('child_process');
const send_team = require('./send_team');


const serviceNames = ['textservice'];

for (const serviceName of serviceNames) {
  // Send email notification
  let subject = '';
  let text = '';
  let flag = false;

  // Wrap the exec function in a Promise
  const executeCommand = () => {
    return new Promise((resolve, reject) => {
      exec(`sudo systemctl status ${serviceName}.service`, (error, stdout, stderr) => {
        if (stderr) {
          subject = `Service ${serviceName} error`;
          text = `Command error: ${stderr}`;
          console.error(text);
          flag = true;
          resolve();
        }

        const statusIndex = stdout.indexOf('Active:');
        if (statusIndex !== -1) {
          const statusSection = stdout.substring(0, statusIndex + stdout.substring(statusIndex).indexOf('\n'));
          console.log(statusSection);
          text += statusSection + '\n\n';

          if (statusSection.indexOf('Active: active (running)') !== -1) {
            subject = `Service ${serviceName} is running successfully.`
            console.log(subject);
            flag = false;
          }
          else {
            subject = `Service ${serviceName} is stopped!`;
            console.log(subject);
            exec(`sudo systemctl restart ${serviceName}.service`);
            exec(`sudo systemctl enable ${serviceName}.service`);
            console.log('Service is restarted now but Please check again');
            text += 'Service is restarted now but Please check again';
            flag = true;
          }
          resolve();
        } else {
          subject = `Service ${serviceName} error`;
          text = 'Error: Failed to retrieve service status information.';
          console.error(text);
          flag = true;
          resolve();
        }
      });
    });
  };

  // Call the executeCommand function and wait for it to finish before sending the email
  executeCommand()
    .then(() => {
      if (flag) {
        for (const receiver_email of ['kingransom9411@gmail.com', 'monitoring@thedevelopers.dev']) {
          send_team.sendEmail(receiver_email, subject, text);
        }
      }
    })
    .catch(() => {
      // Handle any errors here
    });
}
