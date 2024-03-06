const fs = require('fs');
const axios = require('axios');

const tenantId = '5362b414-4db3-4477-88db-8edfeca6fa42';
const teamId = '15ef2e9f-42aa-433e-9a4b-af00ce0ac0f5';
const channelId = '19:vf-Q02UrJVbNbwBGJYLPXs-Op1fiwWre65GxSVcYOo01@thread.tacv2';
const client_id = '1cec76bf-93b8-497b-a53c-70c21c2176a6';
const client_secret = '2XF8Q~SuxClUSnT6.L5YH.gClVrRFa.iTKP5Nb-U';

let msg = {
    "body": {
        "content": "Here is log"
    }
};

// Step 1: Get OAuth token
async function getOAuthToken() {
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    console.log(url);
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
    
    console.log(response.data.access_token);
}

getOAuthToken();