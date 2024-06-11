// const { exec } = require('child_process');

// const serviceName = 'emailservice';

// exec(`sudo systemctl status ${serviceName}.service`, (error, stdout, stderr) => {
//   if (stderr) {
//     console.error(`Command error: ${stderr}`);
//     return;
//   }

//   const statusIndex = stdout.indexOf('Active:');
//   if (statusIndex !== -1) {
//     const statusSection = stdout.substring(0, statusIndex + stdout.substring(statusIndex).indexOf('\n'));        
//     console.log(statusSection);

//     if (statusSection.indexOf('Active: active (running)') !== -1) {
//       console.log(`Service ${serviceName} is running successfully.`);
//     }
//     else {
//       console.log(`Service ${serviceName} is stopped.`);
//       exec(`sudo systemctl restart ${serviceName}.service`);
//       console.log('Service is restarted now but Please check again');
//     }
//   } else {
//     console.error('Error: Failed to retrieve service status information.');
//   }
// });

const nodemailer = require('nodemailer');

const serviceName = 'emailservice';
const emailService = 'Gmail'; // Assuming you are using Gmail

// Configure Nodemailer with the Gmail SMTP settings and your credentials
const transporter = nodemailer.createTransport({
  service: emailService,
  auth: {
    user: 'accounts@thedevelopers.dev',
    pass: 'fkeo qjlm ogos ipdv' // Use the generated app password here
  }
});

// Send email notification
const mailOptions = {
  from: 'accounts@thedevelopers.dev',
  to: 'kingransom9411@gmail.com',
  subject: `Service ${serviceName} is inactive`,
  text: 'Please check service again'
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error(`Error sending email: ${error.message}`);
  } else {
    console.log('Email notification sent successfully.');
  }
});
