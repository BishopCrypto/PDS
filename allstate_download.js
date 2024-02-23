// there are 2 logins.
// markgenova RAL9725RAL
// markgenova1 RaL4100

// node allstate_download.js markgenova RAL9725RAL December 2023
// node allstate_download.js markgenova1 RaL4100 December 2023

// you may look at this code and say 'is all this necessary?' 
// yes the answer is yes its necessary.  The AllState site has a lot of quirks and things to overcome.  
// And its extremely slow in large part because the reports page is gigantic.
// Also, at night, they update all the data in a huge batch operation which turns report generation into a batch process from
// a 'real time' operation.
// And the reports page times out after 15 minutes even if you have been generating reports the whole time.  A page refresh is needed
// because it was the fastest way to eliminate the problem.  

// Define a list of reinsurer names to skip
const skipReinsurers = [
    "BUCKLEY REINSURANCE, LTD.",
    "CWK REINSURANCE, LTD.",
    "EWF II REINSURANCE CO., LTD.",
    "HEAD BROTHERS SERVICE REINSURANCE, LTD.",
    "HESSER REINSURANCE COMPANY, LTD.",
    "LONNIE COBB REINSURANCE, LTD.",
    "LOVE REINSURANCE, LTD.",
    "MAXWELL BAY REINSURANCE, LTD.",
    "RAY BUICK 2 REINSURANCE, LTD.",
    "TAYLOR & ROBBINS REINSURANCE, LTD.",
    "WOLF PACK REINSURANCE, LTD."
];


console.log("Run this code once for each id and password");


const puppeteer = require('puppeteer');
const readline = require('readline');

const Papa = require('papaparse');
const axios = require('axios');
const { PDFDocument, componentsToColor } = require("pdf-lib");
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { table } = require('console');

// Global variables
const masterUser = "markgenova";
const masterPw = "RAL9725RAL";
const loginUrl = "https://login.allstatedealerservices.com/";
const dashboardUrl = "https://allstatedealerservices.com/account/dashboard";
const reportsUrl = 'https://allstatedealerservices.com/reports';
const downloadsUrl = 'https://allstatedealerservices.com/reports/downloads';


// Functions
function getUserInput() {
    // Get command-line arguments instead
    const args = process.argv.slice(2);

    // Check if all required arguments are provided
    if (args.length !== 4) {
        console.error("Usage: node your_program.js <id> <pw> <Month (ie: March)> <year>");
        process.exit(1); // Exit the program with an error code
    }

    // Extract command-line arguments
    const [id, pw, month, year] = args;

    // Format month and year as monthValueToSelect
    const monthValueToSelect = `${month} ${year}`;

    // Now you can use id, pw, and monthValueToSelect in your program
    console.log("ID:", id);
    console.log("Password:", pw);
    console.log("Month Value To Select:", monthValueToSelect);

    return { id, pw, monthValueToSelect };
}


async function login(page, id, pw) {
    console.log('Going to login URL...');
    await page.goto(loginUrl, { waitUntil: 'load', timeout: 0 });
    console.log('Waiting 1 seconds for login...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Typing username...');
    await page.type("#Username", id);

    console.log('Typing password...');
    await page.type('#Password', pw);
    await new Promise(resolve => setTimeout(resolve, 200));

    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('Clicking login button...');
    await page.click('.login-btn');

    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('Done login');

    console.log('Waiting for download page...');
    await new Promise(resolve => setTimeout(resolve, 2000));
}


async function check_4_cookie_button(page) {
    console.log('Clicking cookies button...');

    const cookiesButton = await page.$('a.btn-orange#privacylink3');
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (cookiesButton) {
        await Promise.all([
            cookiesButton.click(),
        ]);
        console.log('Clicked cookies button. Waiting for calm...');
    } else {
        console.log('Cookies button does not exist, skipping...');
    }
}


let downloadedReports = {};

function renameRecentDownload(directoryPath, reinsurer, monthYear) {

    console.log(directoryPath);
    const files = fs.readdirSync(directoryPath);

    if (files.length > 0) {
        const newestFile = files.reduce((a, b) => {
            const fullPathA = path.join(directoryPath, a);
            const fullPathB = path.join(directoryPath, b);
            const statA = fs.statSync(fullPathA);
            const statB = fs.statSync(fullPathB);
            return statA.mtime.getTime() > statB.mtime.getTime() ? a : b;
        });

        console.log('Newest file:', newestFile);
        // You can now use `newestFile` to access the file or its properties.
        if (newestFile) {
            const oldFilePath = path.join(directoryPath, newestFile);
            const newFileName = `${monthYear} - ${reinsurer}.pdf`;
            const newFilePath = path.join(directoryPath, newFileName);

            // Check if the file with the new name already exists
            if (fs.existsSync(newFilePath)) {
                // If file exists, delete it
                fs.unlinkSync(newFilePath);
                console.log(`Deleted existing file: ${newFileName}`);
            }
            // Proceed to rename the file
            fs.renameSync(oldFilePath, newFilePath);
            console.log(`Renamed ${newestFile} to ${newFileName}`);

        } else {
            console.log('No files found in the directory which is weird because we are here.');
        }
    } else {
        console.log('No files found in the directory.');
    }

}


async function main() {
    const userInput = getUserInput();
    const { id, pw, monthValueToSelect } = userInput;

    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'],
        timeout: 0,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const downloadsFolder = path.resolve('./uploader/to_be_uploaded');
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadsFolder
    });

    try {
        await login(page, id, pw);

        await page.goto(downloadsUrl, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log("This is download page.");
        
        check_4_cookie_button(page);
        await new Promise(resolve => setTimeout(resolve, 10000));

        const tableRowsSelector = 'div > div:nth-child(2) > table > tbody > tr';
        const extractedData = await page.$$eval(tableRowsSelector, (rows, monthValueToSelect) => {
            return rows.map(row => {
                const thElement = row.querySelector('th');
                if (!thElement || !thElement.innerText.startsWith('Reinsurance Report |')) {
                    return null;
                }

                const reportDetails = thElement.innerText.split('Reinsurance Report | ')[1];
                const lastCommaIndex = reportDetails.lastIndexOf(',');
                if (lastCommaIndex === -1) {
                    return null;
                }

                const reinsurer = reportDetails.substring(0, lastCommaIndex).trim();
                const monthYear = reportDetails.substring(lastCommaIndex + 1).trim();

                const downloadLinkElement = row.querySelector('a.btn-green[href*="download"]');
                const downloadSelector = downloadLinkElement ? `a[href='${downloadLinkElement.getAttribute('href')}']` : '';

                const deleteLinkElement = row.querySelector('a.btn-green[href*="delete"]');
                const deleteSelector = deleteLinkElement ? `a[href='${deleteLinkElement.getAttribute('href')}']` : '';

                return { reinsurer, monthYear, downloadSelector, deleteSelector };
            }).filter(item => item && item.downloadSelector && item.monthYear === monthValueToSelect);
        }, monthValueToSelect);

        console.log(extractedData);
        
        if (extractedData.length > 0) {
            for (const { reinsurer, monthYear, downloadSelector, deleteSelector } of extractedData) {
                if (skipReinsurers.includes(reinsurer)) {
                    console.log(`Skipping download for: ${reinsurer}`);
                    continue;
                }
                console.log(`Attempting to download report for: ${reinsurer}, ${monthYear}`);
                try {
                    await page.click(downloadSelector);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                    renameRecentDownload(downloadsFolder, reinsurer, monthYear);
                    if (!downloadedReports[reinsurer]) {
                        downloadedReports[reinsurer] = {};
                    }
                    downloadedReports[reinsurer][monthYear] = true;
                    
                    await page.click(deleteSelector);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Error while downloading report for ${reinsurer}, ${monthYear}:`, error);
                }
            }
        } else {
            console.log('No download links found in the reports table, so moving on to generate some.');
        }
        await page.goto(downloadsUrl, { waitUntil: 'networkidle0', timeout: 0 });

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await browser.close();
    }
    console.log('Done generating all reports for Month Year combo and ID.');
}

main();

/*
<tr>
                            <th scope="row">Reinsurance Report | MOBERLY REINSURANCE, LTD.,November 2023</th>
                            <td>12/24/2023</td>
                            <td>
                                <a class="btn-green" onclick="sendEvent('Report Downloads Body Links', 'Click', 'Download')" href="/reports/download/240096?reportName=Reinsurance%20Report">
                                    <span>Download</span>
                                </a>
                                <a class="btn-green" onclick="sendEvent('Report Downloads Body Links', 'Click', 'Delete')" href="/reports/delete?id=240096">
                                    <span>Delete</span>
                                </a>
                            </td>
                        </tr>
*/
