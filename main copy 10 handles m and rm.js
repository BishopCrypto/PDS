
// node ./main.js 052023

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
//const ids_passwords_sheet = 'https://docs.google.com/spreadsheets/d/1wvifroYbCovW9anDjZiChjJWBr4e6E5-/edit#gid=961214637'
//name is in column A, id is in column B, password in column C. some rows are empty/titles and should be skipped.
// if user supplies 'all' as username it goes through the whole list.  
//const username = 'PORC120904rm';   // I THINK THIS IS WHERE WE GET POLICY NUMBER
//const password = 'reinsassoc';
//const password = 'ralltd';



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

async function loginAndSelectDate(page, date, password) {

  console.log('Going to website URL...');
  await page.goto(websiteUrl);
  
  console.log('Typing username...');
  await page.type('#UserName', username);
  
  console.log('Typing password...');
  await page.type('#Password', password);
  
  console.log('Clicking login button...');
  await page.click('#LoginButton');

  console.log('Adding delay for page load...');
  await page.waitForTimeout(2000);  // Wait for 2 seconds

  console.log('Going to cession URL...');
  await page.goto(cessionUrl);

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

  await page.waitForTimeout(1000);
}



// Function to get the policy number from username
function getPolicyNumber() {
  return username.split('rm')[0];  // strip 'rm' from the end of the username
}


async function getPdfNamesAndUrls(page, date) {
  await page.waitForTimeout(2000);
  const spans = await page.$$('span[data-ng-class]');
  const pdfs = [];
  const baseUrl = 'https://www.pdsadm.com/PDSReports';
  
  // Check if the username ends with 'rm' or 'm' and strip the appropriate suffix
  const usernamePolicyPart = username.endsWith('rm') ? username.slice(0, -2) : username.slice(0, -1);

  for (const span of spans) {
    const name = await span.evaluate(el => el.textContent);

    if (!name.endsWith('.pdf')) continue;
    if (name.startsWith('Summary') || name.includes('Combined')) continue;

    const datePart = getDatePart(date);
    const underscoreName = name.replace(/ /g, '_');

    let directory = 'Service%20Contracts';
    // Check if the name starts with specific prefixes and change the directory part accordingly
    if (name.startsWith("GIP-PORC")) {
      directory = 'Texas%20GAP';
    } else if (name.startsWith("GAP-PORC")) {
      directory = 'GAP';
    } else if (name.startsWith("PPM-PORC")) {
      directory = 'PPM';
    } else if (name.startsWith("Chemical-PORC")) {
      directory = 'Protection';
    } else if (name.startsWith("Etch-PORC")) {
      directory = 'TheftDeterrent';
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
    const csvFile = fsnp.readFileSync('PDS-logins.csv', 'utf8');

    const results = Papa.parse(csvFile, {
        header: true, 
        skipEmptyLines: true
    });

    console.log("Parsed CSV Results:", results);

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







async function main() {
  try {
    // Check for username and date arguments.
    if (process.argv.length < 4) {
      console.error("Please provide a username and at least one date.");
      return;
    }

    const username = process.argv[2];
    if (username.includes('/')) {
      console.error("Invalid username. Ensure it does not contain a '/'.");
      return;
    }

    const password = getPasswordFromCSV(username);
    if (!password) {
      console.error('No password found for the given username. Exiting.');
      process.exit(1);
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

    console.log(`Dates to process: ${dates.map(date => date.toISOString()).join(', ')}`);

    for (const date of dates) {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });
      
      await loginAndSelectDate(page, date, password);  // Pass the password to the function

      // Now get the PDF names and URLs using the policy number
      const pdfs = await getPdfNamesAndUrls(page, date);

      // Download each PDF
      for (const pdf of pdfs) {
        const pdfFilename = await downloadPdf(pdf, date, username);
        await extractLastPage(`./downloads/${pdfFilename}`, date, username);

        // Delete the original PDF
        try {
          await fs.unlink(`./downloads/${pdfFilename}`);
          console.log(`Successfully deleted the original file: ${pdfFilename}`);
        } catch (error) {
          console.error(`Failed to delete the file: ${pdfFilename}. Error: ${error.message}`);
        }
      }

      await page.close();
    }
  } catch (err) {
    console.error('An error occurred:', err);
  }
}

main();




