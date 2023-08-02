
// node ./main.js 052023

const fs = require('fs/promises');
const puppeteer = require('puppeteer');
const readline = require('readline');


const rl = readline.createInterface({ 
  input: process.stdin,
  output: process.stdout
});

const websiteUrl = 'https://www.pdsadm.com/PAnet/Account/Login';
const cessionUrl = 'https://www.pdsadm.com/PAnet/Common/CessionStatements';
const username = 'PORC210103rm';   // I THINK THIS IS WHERE WE GET POLICY NUMBER
const password = 'reinsassoc';

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function loginAndSelectDate(page, date) {
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
  
  // Remove 'rm' from the end of the username
  const usernamePolicyPart = username.replace(/rm$/, '');

  for (const span of spans) {
    const name = await span.evaluate(el => el.textContent);

    if (!name.endsWith('.pdf')) continue;
    if (name.startsWith('Summary') || name.includes('Combined')) continue;

    const datePart = getDatePart(date);

    const underscoreName = name.replace(/ /g, '_');
    const url = `${baseUrl}/${usernamePolicyPart}/Reports/Service%20Contracts/${datePart}/${underscoreName}`;

    console.log('Generated URL:', url);

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

async function downloadPdf(pdf) {
  const response = await axios.get(pdf.url, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data, 'binary');
  const dir = './downloads/';

  // If the directory doesn't exist, create it
  await fs.mkdir(dir, { recursive: true });

  // Create a filename from the URL
  const filenameFromUrl = pdf.url.split('/').pop();
  
  await fs.writeFile(dir + filenameFromUrl, buffer);
}




function formatDateForURL(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.toLocaleString('default', { month: 'long' });
  return `${year}-${pad(date.getMonth() + 1)}%20${month}%20${year}`;
}


function formatDateForFilename(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}`;
}

const { PDFDocument } = require('pdf-lib');

async function extractLastPage(pdfPath) {
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
    const outputPdfPath = pdfPath.replace('.pdf', '_last_page.pdf');
    await fs.writeFile(outputPdfPath, pdfBytesSingle);
}


async function main() {
  try {
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
    if (process.argv.length >= 3) {
      const [startMonth, startYear] = process.argv[2].split('/');
      const startDate = new Date(startYear, startMonth - 1);
      const endDate = process.argv.length >= 4 
        ? new Date(process.argv[3].split('/')[1], process.argv[3].split('/')[0] - 1) 
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
      console.log(`Processing date: ${date.toISOString()}`);
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });
      
      console.log('Logging in and selecting date...');
      await loginAndSelectDate(page, date);

      // Get the policy number
      console.log('Getting policy number...');
      const policyNum = await getPolicyNumber(page);

      // Now get the PDF names and URLs using the policy number
      console.log('Getting PDF names and URLs...');
      const pdfs = await getPdfNamesAndUrls(page, date, policyNum);

      // Download each PDF
      console.log(`Downloading ${pdfs.length} PDFs...`);
      for (const pdf of pdfs) {
        await downloadPdf(pdf);
        console.log(`Extracting last page from ${pdf.name}...`);
        await extractLastPage(`./downloads/${pdf.name}`);
      }

      await page.close();
    }

  } catch (err) {
    console.error('An error occurred:', err);
  }
}



main();


