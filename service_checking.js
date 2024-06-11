const { exec } = require('child_process');
const nodemailer = require('nodemailer');

const serviceNames = ['emailservice', 'textservice'];
const emailService = 'Gmail'; // Assuming you are using Gmail

// Configure Nodemailer with the Gmail SMTP settings and your credentials
const transporter = nodemailer.createTransport({
  service: emailService,
  auth: {
    user: 'accounts@thedevelopers.dev',
    pass: 'fkeo qjlm ogos ipdv' // Use the generated app password here
  }
});

for (const serviceName of serviceNames) {
  // Send email notification
  let mailOptions = {
    from: 'accounts@thedevelopers.dev',
    to: '',
    subject: '',
    text: ''
  };
  let subject = '';
  let text = '';

  exec(`sudo systemctl status ${serviceName}.service`, (error, stdout, stderr) => {
    if (stderr) {
      subject = `Service ${serviceName} error`;
      text = `Command error: ${stderr}`;
      console.error(text);
      return;
    }
  
    const statusIndex = stdout.indexOf('Active:');
    if (statusIndex !== -1) {
      const statusSection = stdout.substring(0, statusIndex + stdout.substring(statusIndex).indexOf('\n'));
      console.log(statusSection);
      text += statusSection + '\n\n';
  
      if (statusSection.indexOf('Active: active (running)') !== -1) {
        subject = `Service ${serviceName} is running successfully.`
        console.log(subject);
      }
      else {
        subject = `Service ${serviceName} is stopped.`;
        console.log(subject);
        exec(`sudo systemctl restart ${serviceName}.service`);
        console.log('Service is restarted now but Please check again');
        text += 'Service is restarted now but Please check again';
      }
    } else {
      subject = `Service ${serviceName} error`;
      text = 'Error: Failed to retrieve service status information.';
      console.error(text);
    }
  });
  
  mailOptions['subject'] = subject;
  mailOptions['text'] = text;
  for (const toEmail of ['kingransom9411@gmail.com', 'leo636722@gmail.com']) {
    mailOptions['to'] = toEmail;
    console.log(mailOptions);
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(`Error sending email to ${toEmail}: ${error.message}`);
      } else {
        console.log(`Email notification sent to ${toEmail} successfully.`);
      }
    });
    setTimeout(() => {}, 3000);
  }
}
