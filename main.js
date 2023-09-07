// node ./main.js 052023

// U/N: RALPDS 
// P/W: reinsassoc

const fs = require('fs/promises');
const fsnp = require('fs');
const puppeteer = require('puppeteer');
const readline = require('readline');
const Papa = require('papaparse');

const rl = readline.createInterface({ 
  input: process.stdin,
  output: process.stdout
});

const websiteUrl = 'https://www.pdsadm.com/PAnet/Account/Login';
const cessionUrl = 'https://www.pdsadm.com/PAnet/Common/CessionStatements';
const loginfile = 'PDS-logins.csv'




//PORC120108rm reinsassoc
// Check for command-line arguments for username instead.
if (process.argv.length < 4) {
    console.error('Missing required parameters. Usage: node ./main.js <username> <start_date> [end_date]');
    process.exit(1);
}

const username = process.argv[2]; // Grab the username from command line arguments
if (username.includes('/')) {
    console.error('Error: Username seems to be invalid (contains a "/"). Did you forget to input the username?');
    process.exit(1);
}


function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function login(page, username, password) {
  console.log('Going to website URL...');
  await page.goto(websiteUrl);

  console.log('Typing username...');
  await page.type('#UserName', username);

  console.log('Typing password...');
  await page.type('#Password', password);

  console.log('Clicking login button...');
  await page.click('#LoginButton');

  console.log('Adding delay for page load...');
  await page.waitForTimeout(1000);  // Wait for 2 seconds

  console.log('Going to cession URL...');
  await page.goto(cessionUrl);
}

async function selectDate(page, date) {
  await page.waitForTimeout(1000); // Adding delay to ensure dropdown values are loaded

  const formattedDate = `${date.getFullYear()}${pad(date.getMonth() + 1)} - ${date.getFullYear()} ${date.toLocaleString('default', { month: 'long' })}`;
  console.log(`Selecting date: ${formattedDate}`);

  const wasDateSelected = await page.evaluate((desiredDate) => {
    let select = document.querySelector('select[ng-model="selectedDate"]');
    for(let i = 0; i < select.options.length; i++) {
      if(select.options[i].textContent === desiredDate) {
        select.value = select.options[i].value;
        select.dispatchEvent(new Event('change'));
        return true;
      }
    }
    return false;
  }, formattedDate);

  if (!wasDateSelected) {
    console.error(`Date ${formattedDate} not found in dropdown.`);
    process.exit(1);
  }

  await page.waitForTimeout(500);
}



 

async function getPdfNamesAndUrls(page, date, currentUsername) {
    await page.waitForTimeout(2000);
    const spans = await page.$$('span[data-ng-class]');
    const pdfs = [];
    const baseUrl = 'https://www.pdsadm.com/PDSReports';
    
    // Check if the username ends with 'rm' or 'm' and strip the appropriate suffix
    const usernamePolicyPart = currentUsername.endsWith('rm') ? currentUsername.slice(0, -2) : currentUsername.slice(0, -1);

    for (const span of spans) {
        const name = await span.evaluate(el => el.textContent);
        if (!name.endsWith('.pdf')) continue;
        if (name.startsWith('Summary') || name.includes('Combined')) continue;
        
        const datePart = getDatePart(date);
        const directory = getDirectory(name);
        let underscoreName = processName(name);

        // Fix for KCJ & S McCluskey Fam case
        if (name.includes("KCJ & S McCluskey Fam")) {
            underscoreName = underscoreName.replace('_GAP-PORC.pdf', '%20GAP-PORC.pdf');
            underscoreName = underscoreName.replace('_Etch-PORC.pdf', '%20Etch-PORC.pdf');
        }

        const url = `${baseUrl}/${usernamePolicyPart}/Reports/${directory}/${datePart}/${underscoreName}`;
        console.log('name:', name,' ?url:', url);

        pdfs.push({
            name: underscoreName,
            url 
        });
    }
    return pdfs;
}

function getDirectory(name) {
    const directories = {
        "GIP-PORC": 'Texas%20GAP',
        "GAP": 'GAP',
        "PPM": 'PPM',
        "Chemical": 'Protection',
        "Etch": 'TheftDeterrent',
        "VscRefund": 'VscRefund',
        "DIM": 'Dimension'
    };
    for (const key in directories) {
        if (name.includes(key)) return directories[key];
    }
    return 'Service%20Contracts';
}

function processName(name) {
    if (name.includes("Narrowgate Coldfront") || name.includes("Lion Crusader") || name.includes("KCJ & S McCluskey Fam")) {
        name = name.replace(/ /g, '%20');
        if (name !== "KCJ & S McCluskey Fam Manual Cessions GAP-PORC.pdf") {
            const lastSpaceIndex = name.lastIndexOf('%20');
            if (lastSpaceIndex !== -1) {
                name = name.slice(0, lastSpaceIndex) + "_" + name.slice(lastSpaceIndex + '%20'.length);
            }
        }
        if (name.endsWith("LP-PORC.pdf")) {
            name = "LP-PORC_A.pdf";
        }
        if (name.endsWith("VESC-SC-PORC.pdf")) {
            name = "VESC-SC-PORC_A.pdf";
        }
    } else {
        name = name.replace(/ /g, '_');
    }
    return name;
}





function getDatePart(date) {
  const year = date.getFullYear();
  const month = date.toLocaleString('default', { month: 'long' });
  const datePart = `${year}-${pad(date.getMonth() + 1)} ${month} ${year}`;
  
  return encodeURIComponent(datePart);
}

function pad(number) {
  return (number < 10 ? '0' : '') + number;
}



const axios = require('axios');

async function downloadPdf(pdf, date, policyNum) {
  try {
    console.log('fetching :', pdf.url);
    const response = await axios.get(pdf.url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    const dir = './downloads/';

    // If the directory doesn't exist, create it
    await fs.mkdir(dir, { recursive: true });

    // Create a filename from the URL
    const filenameFromUrl = `${formatDateForFilename(date)}_${policyNum}_${pdf.url.split('/').pop()}`;
    await fs.writeFile(dir + filenameFromUrl, buffer);
    return filenameFromUrl;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error('Error: File not found (404). Exiting process.');
      process.exit(1);
    } else {
      console.error('An error occurred while downloading the PDF:', error.message);
      throw error; // you can choose to either rethrow the error or exit the process here
    }
  }
}





function formatDateForURL(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.toLocaleString('default', { month: 'long' });
  return `${year}-${pad(date.getMonth() + 1)}%20${month}%20${year}`;
}



function formatDateForFilename(date) {
  return `${date.getFullYear()}_${pad(date.getMonth() + 1)}`;
}

const { PDFDocument } = require('pdf-lib');

async function extractLastPage(pdfPath, date, policyNum) {
  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  const lastPage = pdfDoc.getPages()[pageCount - 1];

  // Create a new PDFDocument
  const pdfDocSingle = await PDFDocument.create();
  const [copiedPage] = await pdfDocSingle.copyPages(pdfDoc, [pageCount - 1]);
  pdfDocSingle.addPage(copiedPage);

  // Serialize the PDFDocument to bytes (a Uint8Array)
  const pdfBytesSingle = await pdfDocSingle.save();

  // Save the bytes back to a new PDF file
  const outputPdfPath = `${formatDateForFilename(date)}_${policyNum}_${pdfPath.replace('./downloads/', '').replace('.pdf', '_last_page.pdf')}`;
  await fs.writeFile(`./downloads/${outputPdfPath}`, pdfBytesSingle);
}


function getPasswordFromCSV(targetUsername) {
    const csvFile = fsnp.readFileSync(loginfile, 'utf8');

    const results = Papa.parse(csvFile, {
        header: true, 
        skipEmptyLines: true
    });

    //console.log("Parsed CSV Results:", results);

    // Ignoring first few non-relevant rows (e.g. title rows, URLs, etc.)
    const actualDataStartIndex = results.data.findIndex(row => row.Reinsurer && row.Login && row.Password);

    for (let i = actualDataStartIndex; i < results.data.length; i++) {
        const row = results.data[i];
        if (row.Login === targetUsername) {
            console.log(`Found password for ${targetUsername}: ${row.Password}`);
            return row.Password;
        }
    }
    console.error('Username not found in the CSV.');
    return null;
}



async function loginToWebsite(username) {
    const password = getPasswordFromCSV(username);
    if (!password) {
        console.error('No password is in memory.  Huh. Stopping.');
        return;
    }

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.pdsadm.com/panet/');

    await page.type('#txtUserName', username);
    await page.type('#txtPassword', password);
    await page.click('#btnLogin');

    // Wait for successful login or for an error message
    try {
        await Promise.race([
            page.waitForSelector('#some-success-element', {timeout: 30000}), // replace `#some-success-element` with an actual selector from the website that indicates a successful login
            page.waitForSelector('#some-error-element', {timeout: 30000})   // replace `#some-error-element` with an actual selector from the website that indicates a failed login or error message
        ]);
    } catch (error) {
        console.error('Failed to detect login status. Please check if the selectors are correct or increase the timeout.');
    }

    // The following is optional; it just captures the current page content and logs it
    const content = await page.content();
    console.log(content);

    // Close browser when done (or modify this if you want to keep the session active).
    await browser.close();
}







// Main function to process a single username and list of dates
async function processUsername(browser, username, dates) {
  const password = getPasswordFromCSV(username);
  if (!password) {
    console.error(`No password found for the username: ${username}. Skipping.`);
    return;
  }

  console.log(`Processing username: ${username}`);
  for (const date of dates) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });
      
    await loginAndSelectDate(page, date, password, username);
    const pdfs = await getPdfNamesAndUrls(page, desiredDate, currentUsername);
    for (const pdf of pdfs) {
      const pdfFilename = await downloadPdf(pdf, date, username);
      await extractLastPage(`./downloads/${pdfFilename}`, date, username);
      await fs.unlink(`./downloads/${pdfFilename}`);
    }
    await page.close();
  }
}

// Get all usernames from CSV
function getAllUsernamesFromCSV() {
  const csvFile = fsnp.readFileSync(loginfile, 'utf8');
  const results = Papa.parse(csvFile, {
      header: true, 
      skipEmptyLines: true
  });

  const usernames = results.data.map(row => row.Login).filter(Boolean);
  return usernames;
}

async function main() {
  try {
    // Check for date arguments.
    if (process.argv.length < 4) {
      console.error("Please provide a username and at least one date.");
      return;
    }

    let usernames = [];
    const inputUsername = process.argv[2];

    if (inputUsername === 'all') {
      const csvFile = fsnp.readFileSync(loginfile, 'utf8');
      const results = Papa.parse(csvFile, {
          header: true, 
          skipEmptyLines: true
      });
      usernames = results.data.map(row => row.Login).filter(Boolean);
    } else {
      usernames = [inputUsername];
    }

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ]
    });

    let dates = [];
    if (process.argv.length >= 4) {
      const [startMonth, startYear] = process.argv[3].split('/');
      const startDate = new Date(startYear, startMonth - 1);
      const endDate = process.argv.length >= 5
        ? new Date(process.argv[4].split('/')[1], process.argv[4].split('/')[0] - 1) 
        : new Date(startYear, startMonth - 1);

      for (let date = startDate; date <= endDate; date.setMonth(date.getMonth() + 1)) {
        dates.push(new Date(date));
      }
    } else {
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      dates = [date];
    }

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    for (const username of usernames) {
      console.log('---------------------------------\nnew username/account');
      const password = getPasswordFromCSV(username);
      if (!password) {
        console.error(`No password found for the given username: ${username}. Skipping.`);
        continue;
      }

      await login(page, username, password);

      for (const date of dates) {
        console.log('---------------\nnew date');
        await selectDate(page, date);

        const pdfs = await getPdfNamesAndUrls(page, date, username);

        for (const pdf of pdfs) {
          const pdfFilename = await downloadPdf(pdf, date, username);
          await extractLastPage(`./downloads/${pdfFilename}`, date, username);

          try {
            await fs.unlink(`./downloads/${pdfFilename}`);
            console.log(`Successfully deleted the original file: ${pdfFilename}`);
          } catch (error) {
            console.error(`Failed to delete the file: ${pdfFilename}. Error: ${error.message}`);
          }
        }
      }
    }

    await browser.close();

  } catch (err) {
    console.error('An error occurred:', err);
  }
}


function buildDates() {
  let dates = [];
  if (process.argv.length >= 4) {
    const [startMonth, startYear] = process.argv[3].split('/');
    const startDate = new Date(startYear, startMonth - 1);
    const endDate = process.argv.length >= 5
      ? new Date(process.argv[4].split('/')[1], process.argv[4].split('/')[0] - 1)
      : new Date(startYear, startMonth - 1);

    for (let date = startDate; date <= endDate; date.setMonth(date.getMonth() + 1)) {
      dates.push(new Date(date));
    }
  } else {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    dates = [date];
  }
  return dates;
}

async function navigateToLoginPage(page) {
  const loginUrl = websiteUrl; // Replace with the URL of your login page
  await page.goto(loginUrl, { waitUntil: 'networkidle2' });
}



main();




