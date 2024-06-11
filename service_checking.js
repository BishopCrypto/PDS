const { exec } = require('child_process');

const serviceName = 'emailservice';

exec(`systemctl status ${serviceName}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing command: ${error.message}`);
    return;
  }

  if (stderr) {
    console.error(`Command error: ${stderr}`);
    return;
  }

  const statusIndex = stdout.indexOf('Active:');
  if (statusIndex !== -1) {
    const statusSection = stdout.substring(0, statusIndex + stdout.substring(statusIndex).indexOf('\n'));
    console.log(`Service ${serviceName} is running successfully.`);
    console.log(statusSection);
  } else {
    console.error('Error: Failed to retrieve service status information.');
  }
});
