const fs = require('fs');
const axios = require('axios');

const tenantId = '5362b414-4db3-4477-88db-8edfeca6fa42';
const client_id = '1cec76bf-93b8-497b-a53c-70c21c2176a6';
const client_secret = '2XF8Q~SuxClUSnT6.L5YH.gClVrRFa.iTKP5Nb-U';

const drive_id = 'b!kck-pQ2_IkyTuHyKmCzyZi-h1sZ3naRNm0zqjsBoQK-91LKVrHF4R5sabQDSkMXm';
const item_id = '01UTXNFWJLAXWXFN652RHZQFINX5QAIT6W';


async function getDownloadUrl() {
  try {
    const url = `https://graph.microsoft.com/v1.0/drives/${drive_id}/items/${item_id}/children`;
    const accessToken = await getOAuthToken();
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const downloadUrl = response.data.value[1]["@microsoft.graph.downloadUrl"];
    return downloadUrl;
  } catch (error) {
    console.log("Failed to get XLSX download URL");
    process.exit(1);
  }
}


// Step 1: Get OAuth token
async function getOAuthToken() {
  try {
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const data = new URLSearchParams();
    data.append('client_id', client_id);
    data.append('client_secret', client_secret);
    data.append('grant_type', 'client_credentials');
    data.append('scope', 'https://graph.microsoft.com/.default');
    
    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    console.log("Successfully created OAuth Token for Authentication email");
    return response.data.access_token;  
  } catch (error) {
    console.log("Failed to get OAuth Token for Authentication email");
    process.exit(1);
  }
}

// Step 2: Create Subscription
async function createSubscription() {
  const accessToken = await getOAuthToken();
  const url = `https://graph.microsoft.com/v1.0/subscriptions`;
  const data = {
    changeType: "created",
    notificationUrl: "https://5b05-167-88-171-25.ngrok-free.app/email-webhook/",
    resource: "/users/authentication@reinsuranceassociates.com/messages",
    expirationDateTime: "2024-04-30T11:00:00.0000000Z",
    clientState: "secretClientValue"
  };

  await axios.post(url, data, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })
  .then((response) => {
    console.log('Successfully created subscription.');
  })
  .catch((err) => {
    console.log('Failed to create subscription.');
  });
}

// Step 3: Update Subscription
async function updateSubscription() {
  const accessToken = await getOAuthToken();
  const sub_id = await getSubscription();
  const url = `https://graph.microsoft.com/v1.0/subscriptions/${sub_id}`;

  const currentDate = new Date();
  currentDate.setMinutes(currentDate.getMinutes() + 10060);

  const data = {
    expirationDateTime: currentDate.toISOString(),
  };
  
  await axios.patch(url, data, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })
  .then((response) => {
    console.log('Successfully updated subscription.');
  })
  .catch((err) => {
    console.log(err)
    console.log('Failed to update subscription.');
  });
}

// Step 4: Get Subscription
async function getSubscription() {
  const accessToken = await getOAuthToken();
  const url = `https://graph.microsoft.com/v1.0/subscriptions`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const sub_id = response.data.value[0].id;
    console.log(`Successfully got subscription: ${sub_id}`);
    return sub_id;
  } catch (err) {
    console.log('Failed to get subscription.');
  }
}

// Get emails of authentication@reinsuranceassociates.com
async function getEmails() {
  const accessToken = await getOAuthToken();
  const url = 'https://graph.microsoft.com/v1.0/users/authentication@reinsuranceassociates.com/messages';

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const email = response.data.value[0];
    
    console.log('Successfully got emails.');
    return email;
  } catch (err) {
    console.log('Failed to get emails.');
  }
}


module.exports = {
  getEmails: getEmails,
  updateSubscription: updateSubscription,
  getDownloadUrl: getDownloadUrl
};
