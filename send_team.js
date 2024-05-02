const fs = require('fs');
const axios = require('axios');

const tenantId = '5362b414-4db3-4477-88db-8edfeca6fa42';
const channelId = '19:vf-Q02UrJVbNbwBGJYLPXs-Op1fiwWre65GxSVcYOo01@thread.tacv2';
const client_id = '1cec76bf-93b8-497b-a53c-70c21c2176a6';
const client_secret = '2XF8Q~SuxClUSnT6.L5YH.gClVrRFa.iTKP5Nb-U';

const original_teamId = '15ef2e9f-42aa-433e-9a4b-af00ce0ac0f5';
const portal_teamId = '19e885b6-1d0c-4366-9a4b-de357c9bebd7';

const original_channelId = '19%3Avf-Q02UrJVbNbwBGJYLPXs-Op1fiwWre65GxSVcYOo01%40thread.tacv2';
const general_channelId = '19%3A7XPhLeHUOPIKNHRpMvNGtSsVP_VhRBNUjpbveTRHdvY1%40thread.tacv2';
const twofactor_channelId = '19%3Af0a31f7cdb5546748da1c0e459e7b4b6%40thread.tacv2';
const crawler_channelId = '19%3A21657cc7f97e4af2bb2aedce4a4ce90a%40thread.tacv2';
const training_channelId = '19%3A19fad035a4ff42ff916968859fd96307%40thread.tacv2';


// Step 1: Get OAuth token
async function getOAuthToken() {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const data = new URLSearchParams();
  data.append('client_id', client_id);
  data.append('client_secret', client_secret);
  data.append('grant_type', 'password');
  data.append('scope', 'user.read openid profile offline_access');
  data.append('username', 'Reporting@Reinsuranceassociates.onmicrosoft.com');
  data.append('password', 'Gova522403');
  
  const response = await axios.post(url, data, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return response.data.access_token;
}

// Step 2: Sending Message
async function sendMessageToTeamChannel(message, channel) {
  const teamId = portal_teamId;
  let channelId = '';
  if (channel == '2fa') {
    channelId = twofactor_channelId;
  }
  else if (channel == 'crawler') {
    channelId = crawler_channelId;
  }
  else if (channel == 'training') {
    channelId = training_channelId;
  }
  else {
    channelId = general_channelId;
  }
  const accessToken = await getOAuthToken();
  const url = `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`;
  const data = {
    "body": {
      "content": message,
      "contentType": "html"
    }
  };

  await axios.post(url, data, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })
  .then((response) => {
    console.log('Successfully sent log to Team Channel.');
  })
  .catch((err) => {
    console.log('Failed to send log to Team Channel.');
  });
}


module.exports = {
  sendMessageToTeamChannel: sendMessageToTeamChannel
};
