// there are 2 logins.
//markgenova RAL9725RAL
//markgenova1 RaL4100 

// you may look at this code and say 'is all this necessary?' 
// yes the answer is yes its necessary.  The AllState site has a lot of quirks and things to overcome.  
// And its extremely slow in large part because the reports page is gigantic.
//Also, at night, they update all the data in a huge batch operation which turns report generation into a batch process from
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
const { PDFDocument } = require("pdf-lib");
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path'); 

// Global variables
const masterUser = "markgenova";
const masterPw = "RAL9725RAL";
const loginUrl = "https://login.allstatedealerservices.com/";
const dashboardUrl = "https://allstatedealerservices.com/account/dashboard";
const reportsUrl='https://allstatedealerservices.com/reports';
const downloadsurl='https://allstatedealerservices.com/reports/downloads';

// Functions
async function login(page,id,pw) {
    console.log('Going to login URL...');
    await page.goto(loginUrl, { waitUntil: 'load', timeout: 0 });
       console.log('wait 3 seconds for login...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Typing username...');
    await page.type("#Username", id); //masterUser);

    //console.log('Crunch cookie (if it does not exist we are stuck)...');
    //while(!check_4_cookie_button(false));

    console.log('Typing password...');
    await page.type('#Password', pw);
    await new Promise(resolve => setTimeout(resolve, 200));



    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('Clicking login button...');
    await page.click('.login-btn');
    //await page.waitForNavigation({ timeout: 250 });
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('done loggin in');


    console.log('waiting 2 secs...');
    await new Promise(resolve => setTimeout(resolve, 2000));
 


    //check_4_cookie_button(page); //it happens on the download page i think but still this won't hurt 



        /*
    try {
        await page.click('a.btn-orange#privacylink3'); 
    } catch (error) {
        console.log('No cookies link found');
    }*/
}

async function extractDownloadUrls(page) {
    // This selector targets anchor tags with class 'btn-green' and href containing 'download'
    const selector = "a.btn-green[href*='download']";
    return page.$$eval(selector, links => links.map(link => link.href));

}

 
 
async function downloadFile(page, url, targetPath) {
    const downloadsDir = path.resolve(__dirname, 'downloads');
    await fs.promises.mkdir(downloadsDir, { recursive: true });

    const fileName = path.basename(targetPath);
    const finalPath = path.join(downloadsDir, fileName);

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadsDir,
    });

    await page.goto(url);
    // Implement custom wait logic if needed

    console.log(`Downloaded file to ${finalPath}`);
}




async function check_4_cookie_button(page) {
    console.log('Clicking cookies button...');
    
    const cookiesButton = await page.$('a.btn-orange#privacylink3');
    
    if (cookiesButton) {
        await Promise.all([
            page.waitForNavigation(), // Wait for navigation to complete
            cookiesButton.click(),
        ]);
        console.log('Clicked cookies button. Waiting for calm...');
        await page.waitForTimeout(1000); // Wait for a moment to let things calm down
    } else {
        console.log('Cookies button does not exist, skipping...');
    }
}



//const readline = require('readline');


    /*
  return new Promise(async (resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const id = await new Promise((resolve) => {
      rl.question('Enter your ID: ', (id) => {
        resolve(id);
      });
    });

    const pw = await new Promise((resolve) => {
      rl.question('Enter your password: ', (pw) => {
        resolve(pw);
      });
    });

    const currentDate = new Date();
    currentDate.setMonth(currentDate.getMonth() - 1);
    const defaultMonthValue = currentDate.toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    });

    const monthValueToSelect= await new Promise((resolve) => {
      rl.question('Enter your month year: ', (monthValueToSelect) => {
        resolve(monthValueToSelect);
      });
    });

    /*
    const monthValue = await new Promise((resolve) => {
      rl.question(`Enter the month and year (e.g., "November 2023", press Enter for default "${defaultMonthValue}"): `, (month) => {
        resolve(month.trim() || defaultMonthValue);
      });
    });
   

    rl.close();
 */ 

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

let downloadedReports = {};

function renameRecentDownload(directoryPath, reinsurer, monthYear) {

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
        headless: false,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'],
        timeout: 0,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');
    await page.setExtraHTTPHeaders({'Accept-Language': 'en-US,en;q=0.9'});

    const downloadsFolder = './downloads/';
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadsFolder
    });

    try {
        await login(page, id, pw);
        console.log('Logged in successfully');

        await page.goto(downloadsurl, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        check_4_cookie_button(page);

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

                return { reinsurer, monthYear, downloadSelector };
            }).filter(item => item && item.downloadSelector && item.monthYear === monthValueToSelect);
        }, monthValueToSelect);

        if (extractedData.length > 0) {
            for (const { reinsurer, monthYear, downloadSelector } of extractedData) {
                if (skipReinsurers.includes(reinsurer)) {
                    console.log(`Skipping download for: ${reinsurer}`);
                    continue;
                }
                console.log(`Attempting to download report for: ${reinsurer}, ${monthYear}`);
                try {
                    await page.click(downloadSelector);
                    await page.waitForTimeout(600);
                    renameRecentDownload(downloadsFolder, reinsurer, monthYear);
                    if (!downloadedReports[reinsurer]) {
                        downloadedReports[reinsurer] = {};
                    }
                    downloadedReports[reinsurer][monthYear] = true;
                } catch (error) {
                    console.error(`Error while downloading report for ${reinsurer}, ${monthYear}:`, error);
                }
            }
        } else {
            console.log('No download links found in the reports table, so moving on to generate some.');
        }

        await page.goto(dashboardUrl, { waitUntil: 'networkidle0', timeout: 0 });
        await page.goto(reportsUrl, { waitUntil: 'networkidle0', timeout: 0 });
        await page.waitForSelector('#inputReinsurer', { visible: true, timeout: 0 });

        const buttonSelector = '#reinsuranceRegisterReportSection > form > div > div > div.col-12.mt-3.text-right > button';
        const dropdownSelector = '#inputReinsurer'; 
        // <select id="inputReinsurer" class="form-control" required=""><option value="">Choose...</option><option value="1032052391">AIR CAP HOLDINGS REINSURANCE, LTD.</option><option value="1034982051">ALL MOXIE HOLDINGS REINSURANCE, LTD.</option><option value="1045138037">AUTO DF REINSURANCE, LTD.</option><option value="1052969960">AUTO FF REINSURANCE, LTD.</option><option value="1023548569">AUTOMOTIVE DEVELOPMENT GROUP REINSURANCE, LTD.</option><option value="1026933924">BARON GROUP REINSURANCE, LTD.</option><option value="1048600145">BET REINSURANCE, LTD.</option><option value="1052189651">BNJ REINSURANCE, LTD.</option><option value="1027143957">BRINDLE DOG REINSURANCE, LTD.</option><option value="1029716467">BSLG REINSURANCE, LTD.</option><option value="1032052412">BSM HOLDINGS REINSURANCE, LTD.</option><option value="1050336508">BUCKLEY REINSURANCE, LTD.</option><option value="1027174763">CDRP REINSURANCE, LTD.</option><option value="1022786263">COASTAL PLAINS II REINSURANCE, LTD.</option><option value="1016294594">COASTAL PLAINS REINSURANCE CO. LTD.</option><option value="1022013672">CONNOR CASH REINSURANCE LIMITED</option><option value="1026602279">COURT LAINE REINSURANCE, LTD.</option><option value="1032717006">CURTTRIGHT REINSURANCE, LTD.</option><option value="1048394859">CWK REINSURANCE, LTD.</option><option value="1029582713">DCG REINSURANCE, LTD.</option><option value="1044706433">DILIGENCE REINSURANCE, LTD.</option><option value="1016171011">EARL &amp; BURTON REINSURANCE, LTD.</option><option value="1041354161">EWF II REINSURANCE CO., LTD.</option><option value="1050276400">FORMULA ONE REINSURANCE, LTD.</option><option value="1030349917">HEAD BROTHERS SERVICE REINSURANCE, LTD.</option><option value="1029554627">HJP REINSURANCE, LTD.</option><option value="1016011990">HYDE ENTERPRISES LLC REINSURANCE, LTD.</option><option value="1027050522">I.B.R. REINSURANCE, LTD.</option><option value="1021380765">IDS COMPANIES REIN. LTD.</option><option value="1033328435">JBH HOLDINGS REINSURANCE, LTD.</option><option value="1053259283">JMG REINSURANCE, LTD.</option><option value="1030140397">JUNIPER REINSURANCE, LTD.</option><option value="1029582535">KEYSTONE REINSURANCE, LTD.</option><option value="1027174726">LANGGAR REINSURANCE, LTD.</option><option value="1021721841">LONNIE COBB REINSURANCE, LTD.</option><option value="1049953118">LOVE AUTOMOTIVE REINSURANCE, LTD.</option><option value="1029757439">LOVE REINSURANCE, LTD.</option><option value="1045313316">LUCKY 7 REINSURANCE, LTD.</option><option value="1021784843">MALONE REINSURANCE, LTD.</option><option value="1048394840">MAXWELL BAY REINSURANCE, LTD.</option><option value="1035006349">MCAS I REINSURANCE, LTD.</option><option value="1044863484">MCCLUSKEY FAMILY REINSURANCE, LTD.</option><option value="1035866477">MERREM II REINSURANCE, LTD.</option><option value="1029554628">MOBERLY REINSURANCE, LTD.</option><option value="1022227877">MORIAH REINSURANCE, LTD.</option><option value="1031011575">MOXIE HOLDINGS REINSURANCE, LTD.</option><option value="1033971166">MSA INVESTORS REINSURANCE, LTD.</option><option value="1019202841">OPM REINSURANCE, LTD.</option><option value="1054552689">OSTONAKULOV REINSURANCE, LTD.</option><option value="1057153006">PANTHER CREEK REINSURANCE, LTD.</option><option value="1035223694">PARKER CAPITAL REINSURANCE, LTD.</option><option value="1090687758">QUIGLEY 1921 PARTNERS REINSURANCE, LTD.</option><option value="1052561300">RAY BUICK 2 REINSURANCE, LTD.</option><option value="1047042865">RIDE HOLDINGS REINSURANCE, LTD.</option><option value="1039929990">ROC II REINSURANCE, LTD.</option><option value="1022786304">RTF III REINSURANCE, LTD.</option><option value="1085053355">RTF IV REINSURANCE, LTD.</option><option value="1016344483">SEA BRIGHT REINSURANCE, LTD.</option><option value="1034623493">SLW REINSURANCE, LTD.</option><option value="1034571968">SOUTH COAST REINSURANCE, LTD.</option><option value="1023065278">SOUTHERN PLANTATION REINSURANCE, LTD.</option><option value="1047042802">SUPER MOXIE REINSURANCE, LTD.</option><option value="1054571206">TAG INVESTMENTS REINSURANCE, LTD.</option><option value="1022121074">TAYLOR &amp; ROBBINS REINSURANCE, LTD.</option><option value="1011205784">TILLERY REINSURANCE SERVICES INC., LTD.</option><option value="1022227893">VANCE REINSURANCE CO., LTD.</option><option value="1051662234">WOLF PACK REINSURANCE, LTD.</option></select>
        const monthDropdownXPath = '/html/body/div[1]/div/main/div[2]/div/div[5]/div[4]/form/div/div/div[2]/select';

        const reinsurerOptions = await page.$$eval(dropdownSelector + ' option', options => 
            options.map(option => ({
                key: option.value,
                label: option.textContent.trim()
            }))
        );

        let startTime = Date.now();
        let reportsProcessed = 0;

        for (const [index, option] of reinsurerOptions.entries()) {
            if (index === 0) continue; // Skip the first entry, it says 'Choose...'

            if (skipReinsurers.includes(option.label)) {
                console.log(`Skipping generation of report for: ${option.label}`);
                continue;
            }

            console.log(`Generating ${index + 1}/${reinsurerOptions.length}: ${option.label} (${option.key})`);

            await page.select(dropdownSelector, option.key); // this is the reinsurer

            console.log(`trying to select ${monthValueToSelect}`);
            const [monthDropdown] = await page.$x(monthDropdownXPath);
            await monthDropdown.select(monthValueToSelect); // this is the month.

            console.log('clicking generate report button');
            await page.click(buttonSelector);

            await page.waitForFunction(
                text => document.body.innerText.includes(text),
                { timeout: 600000 }, 
                "Reinsurance report submitted successfully!"
            );
            console.log(`Report submitted for ${option.label}.`);
            await new Promise(resolve => setTimeout(resolve, 10000));

            let elapsedTime = (Date.now() - startTime) / 1000;
            let reportsCompleted = ++reportsProcessed;
            let remainingReports = reinsurerOptions.length - reportsCompleted;
            let estimatedTimeRemaining = (elapsedTime / reportsCompleted) * remainingReports;
            console.log(`Elapsed time: ${Math.round(elapsedTime / 60)} minutes`);
            console.log(`Estimated time remaining: ${Math.round(estimatedTimeRemaining / 60)} minutes for ${remainingReports} remaining reports`);

            console.log('Reloading page because of eventual time-out');
            await page.reload({ waitUntil: 'networkidle0', timeout: 100000 });  
            await page.waitForSelector(dropdownSelector, { visible: true, timeout: 0 });
        }
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