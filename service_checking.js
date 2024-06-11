const { exec } = require('child_process');

exec('systemctl is-active emailservice', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing command: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Command error: ${stderr}`);
    return;
  }
  if (stdout.trim() === 'active') {
    console.log('Service is running successfully.');
  } else {
    console.log('Service is not running.');
    // You can implement further actions here if the service is not running.
  }
});
