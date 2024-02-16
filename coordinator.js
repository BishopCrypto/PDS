const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// Step 1: Get OAuth token
async function getOAuthToken() {
    const url = 'https://rallcstage.azurewebsites.net/oauth/token';
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
    const url = 'https://rallcstage.azurewebsites.net/api/intakeDocument';
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
    const url = 'https://rallcstage.azurewebsites.net/api/DocumentIntakeLogs';
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
    const url = `https://rallcstage.azurewebsites.net/api/files/uploadStatement/?name=${filename}`;
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
async function updateIntakeDocument(accessToken, intakeDocument, status) {
    const intakeDocumentId = intakeDocument.intakeDocument_ID;
    const url = `https://rallcstage.azurewebsites.net/api/intakeDocument/${intakeDocumentId}`;
    intakeDocument.status = status;
    const response = await axios.put(url, intakeDocument, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data;
}

let count = 0;
// main function
async function main(downloadFolderPath, uploadFolderPath) {
    fs.mkdir(uploadFolderPath, { recursive: true }, (err) => {
        if (err) {
          console.error('Error creating directory:', err);
          return;
        }
        console.log('Directory created successfully');
    });
    
    fs.readdir(downloadFolderPath, (err, files) => {
        if (err) {
            console.error('Error reading folder:', err);
            return;
        }
        files.forEach(async file => {
            try {
                count ++;
                console.log(count);
                console.log(file);
                const sourcePath = path.join(downloadFolderPath, file);
                const destPath = path.join(uploadFolderPath, file);
                const accessToken = await getOAuthToken();
                const originalFileName = file;
                const originationSource = 'webdrop';
                const intakeDocument = await createIntakeDocument(accessToken, originalFileName, originationSource);
                const intakeDocumentLog = await createIntakeDocumentLog(accessToken, 'UPLOADING', 'ralstage', `Uploading file ${originalFileName} to intake`, intakeDocument.fileName);
                const uploadResponse = await uploadStatement(accessToken, intakeDocument.fileName, sourcePath);
                const updatedIntakeDocument = await updateIntakeDocument(accessToken, intakeDocument, 'Waiting');
                console.log(updatedIntakeDocument);

                fs.rename(sourcePath, destPath, err => {
                    if (err) {
                        console.error(`Error moving file ${file}:`, err);
                    } else {
                        console.log(`File ${file} moved successfully.`);
                    }
                });
            } catch (error) {
                console.error('Error:', error.response);
            }
        });
    });
}

let downloadFolderPath = './uploader/to_be_uploaded';
let uploadFolderPath = './uploader/uploaded';

if (fs.existsSync(downloadFolderPath)) {
    main(downloadFolderPath, uploadFolderPath);
}
