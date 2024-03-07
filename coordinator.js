const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const util = require('util');

const send_team = require('./send_team');

let args = process.argv;

function showsHelp(){
    console.error('===================== Usage =====================');
    console.error('Example: node coordinator.js trust prod');
    console.error('Example: node coordinator.js cession stage');
    console.error('Example: node coordinator.js allstate prod');
    process.exit(1);
}

if (args.length != 4) {
    showsHelp();
}

let type = args[2];
if (type !== 'trust' && type !== 'cession' && type !== 'allstate') {
    showsHelp();
}

if (args[3] !== 'stage' && args[3] !== 'prod') {
    showsHelp();
}

const endpoint = `https://rallc${args[3]}.azurewebsites.net`;
const tofilePath = `ral${args[3]}`;

// Step 1: Get OAuth token
async function getOAuthToken() {
    const url = `${endpoint}/oauth/token`;
    const data = new URLSearchParams();
    data.append('grant_type', 'client_credentials');
    data.append('client_id', 'a934a88b4bed4a12g7d888f5c43dcb68');
    data.append('client_secret', 'a1zdabwfPpFcFdMft6asfzLkO1aa_K9vKe9SJezPwWs');
    const response = await axios.post(url, data, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data.access_token;
}

// Step 2: Creating the `intakeDocument` record for an uploaded statement
async function createIntakeDocument(accessToken, originalFileName, originationSource = 'webdrop') {
    const url = `${endpoint}/api/intakeDocument`;
    const data = {
        originalFileName: originalFileName,
        OriginationSource: originationSource
    };
    const response = await axios.post(url, data, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data;
}

// Step 3: Creating the `intakeDocumentLog` record for an uploaded statement
async function createIntakeDocumentLog(accessToken, status, filepath, description, filename) {
    const url = `${endpoint}/api/DocumentIntakeLogs`;
    const data = {
        status: status,
        type: 'INTAKE',
        description: description,
        filepath: filepath,
        filename: filename
    };
    const response = await axios.post(url, data, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data;
}

// Step 4: Uploading the statement
async function uploadStatement(accessToken, filename, file) {
    const url = `${endpoint}/api/files/uploadStatement/?name=${filename}`;
    const data = new FormData();
    data.append('file', fs.createReadStream(file), 'filename.ext');
    const response = await axios.post(url, data, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'multipart/form-data'
        }
    });
    return response;
}

// Step 5: Update the `intakeDocument` record with a status of "Waiting"
async function updateIntakeDocument(accessToken, intakeDocument, status, filePath) {
    const intakeDocumentId = intakeDocument.intakeDocument_ID;
    const url = `${endpoint}/api/intakeDocument/${intakeDocumentId}`;
    intakeDocument.status = status;
    intakeDocument.filePath = filePath;
    const response = await axios.put(url, intakeDocument, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data;
}


async function upload_to_api() {
    const downloadFolderPath = './uploader/to_be_uploaded';
    const uploadFolderPath = './uploader/uploaded';

    const readdir = util.promisify(fs.readdir);
    try {
        const files = await readdir(downloadFolderPath);

        const fileStats = files.map(file => {
            return { file, stats: fs.statSync(path.join(downloadFolderPath, file)) };
        });

        const sortedFiles = fileStats
            .filter(fs => fs.stats.isFile())
            .sort((a, b) => a.stats.mtime - b.stats.mtime)
            .map(fs => fs.file);

        let count = 0;
        for (const file of sortedFiles) {
            if (file.startsWith(type)) {
                count ++;
                console.log(count);
                console.log(file);

                const sourcePath = path.join(downloadFolderPath, file);
                const destPath = path.join(uploadFolderPath, file);
                const accessToken = await getOAuthToken();
                const originalFileName = file;
                const originationSource = 'webdrop';
                const filePath = tofilePath;
                const intakeDocument = await createIntakeDocument(accessToken, originalFileName, originationSource);
                const documentLog = await createIntakeDocumentLog(accessToken, 'UPLOADING', filePath, `Uploading file ${originalFileName} to intake`, intakeDocument.fileName);
                const uploadResponse = await uploadStatement(accessToken, intakeDocument.fileName, sourcePath);
                const updateResponse = await updateIntakeDocument(accessToken, intakeDocument, 'Waiting', filePath);
                console.log(updateResponse);

                // Move the file
                fs.renameSync(sourcePath, destPath);
                console.log(`File ${file} moved successfully.`);
            }
        }
        
        console.log(`\nTotal count: ${count}`);

        // Prepare message
        type = (type === 'trust' || type === 'cession') ? `pds ${type}` : type;
        const currentDate = new Date();
        const logtxt = `${currentDate.toISOString().split('T')[0]}, ${count} ${type}, api upload\n`;
        console.log(logtxt);
        fs.appendFileSync('log.txt', logtxt);
        
        send_team.sendMessageToTeamChannel(logtxt);

    } catch (error) {
        console.error('Error: ', error);
    }
}


upload_to_api();
