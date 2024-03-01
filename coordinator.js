// node coordinator.js

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
async function updateIntakeDocument(accessToken, intakeDocument, status, filePath) {
    const intakeDocumentId = intakeDocument.intakeDocument_ID;
    const url = `https://rallcstage.azurewebsites.net/api/intakeDocument/${intakeDocumentId}`;
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


let count = 0;

async function main(downloadFolderPath, uploadFolderPath) {
    const currentDate = new Date();
    const recency = 365;
    const oldDate = new Date(currentDate);
    oldDate.setDate(currentDate.getDate() - recency);
    console.log("Start Date:", oldDate);
    
    fs.readdir(downloadFolderPath, (err, files) => {
        if (err) {
            console.error('Error reading folder:', err);
            return;
        }

        // Filter files based on modification date
        const filteredFiles = files.filter(file => {
            const filePath = path.join(downloadFolderPath, file);
            const stats = fs.statSync(filePath);
            return stats.isFile() && stats.mtime > oldDate;
        });

        // Get the file stats for each remaining file
        const fileStats = filteredFiles.map(file => {
            const filePath = path.join(downloadFolderPath, file);
            return { file, stats: fs.statSync(filePath) };
        });

        // Sort the remaining files by modification time (from oldest to newest)
        fileStats.sort((a, b) => a.stats.mtime - b.stats.mtime);

        // Get the sorted file names
        const sortedFiles = fileStats.map(fileStat => fileStat.file);

        sortedFiles.forEach(async (file) => {
            try {
                count++;
                console.log(count);
                console.log(file);

                const sourcePath = path.join(downloadFolderPath, file);
                const destPath = path.join(uploadFolderPath, file);
                const accessToken = await getOAuthToken();
                const originalFileName = file;
                const originationSource = 'webdrop';
                const filePath = 'ralprod';
                const intakeDocument = await createIntakeDocument(accessToken, originalFileName, originationSource);
                const intakeDocumentLog = await createIntakeDocumentLog(accessToken, 'UPLOADING', filePath, `Uploading file ${originalFileName} to intake`, intakeDocument.fileName);
                const uploadResponse = await uploadStatement(accessToken, intakeDocument.fileName, sourcePath);
                const updatedIntakeDocument = await updateIntakeDocument(accessToken, intakeDocument, 'Waiting', filePath);
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
        let logtxt = `api upload, ${currentDate.toISOString().split('T')[0]}, ${count} uploads\n`;
        fs.appendFile('log.txt', logtxt, function (err) {
            if (err) throw err;
        });
    });
}

let downloadFolderPath = './uploader/to_be_uploaded';
let uploadFolderPath = './uploader/uploaded';

if (!fs.existsSync(uploadFolderPath)) {
    fs.mkdir(uploadFolderPath, { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating directory:', err);
            return;
        }
        console.log('Directory created successfully.');
    });
}

main(downloadFolderPath, uploadFolderPath);
