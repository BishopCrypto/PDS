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
  await page.goto(websiteUrl);
  await page.type('#UserName', username);
  await page.type('#Password', password);
  await page.click('#LoginButton');
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






function pad(number) {
  return (number < 10 ? '0' : '') + number;
}

async function getPdfNamesAndUrls(page, date) {

  await page.waitForTimeout(2000);

  const spans = await page.$$('span[data-ng-class]');

  const pdfs = [];

  const baseUrl = 'https://www.pdsadm.com/PDSReports';

  for (const span of spans) {

    const name = await span.evaluate(el => el.textContent);

    if (!name.endsWith('.pdf')) continue;
    
    // Get policy number 
    const policyNum = name.split(' ')[0];  

    const datePart = getDatePart(date);

    const encodedName = encodeURIComponent(name);
    
    // Construct URL with policyNum
    const url = `${baseUrl}/${policyNum}/Reports/Combined/${datePart}/${encodedName}`;

    console.log('Generated URL:', url);
    
    pdfs.push({
      name,
      url 
    });

  }

  return pdfs;

}

function getDatePart(date) {

  const year = date.getFullYear();
  const month = date.toLocaleString('default', { month: 'long' });
  
  const datePart = `${year}-${pad(date.getMonth() + 1)}%20${month}%20${year}`;
  
  return datePart;

}

async function downloadPdf(page, pdf) {
  const response = await page.goto(pdf.url);
  const buffer = await response.buffer(); 

  const dir = './downloads/';

  // If the directory doesn't exist, create it
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(dir + pdf.name, buffer);
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


// Modified 'clickSummaryVescLinks' function
async function clickSummaryVescLinks(page, browser, date) {
  await page.waitForSelector('span.ng-binding');

  const spanElements = await page.$$('span.ng-binding');

  for (let i = 0; i < spanElements.length; i++) {
    const span = spanElements[i];
    const spanText = await page.evaluate(el => el.textContent.trim(), span);

    if (spanText.includes("Summary VESC")) {
      await page.evaluate(el => el.click(), span);
      await page.waitForTimeout(2000);
      
      const pages = await browser.pages();
      const newPage = pages[pages.length - 1];

      newPage.on('response', async (response) => {
        const url = response.url();
        if (url.endsWith('.pdf')) {
          const buffer = await response.buffer();
          await fs.writeFile(`downloads/${formatDateForFilename(date)}_${i}.pdf`, buffer);
        }
      });

      await newPage.goto(newPage.url());
      await newPage.close();
    }
  }
}

// Modified 'main' function
async function main() {

  //print("TASK: download all Summary X in every folder except Combined.")

  try {
    const browser = await puppeteer.launch({headless: false});

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

    for (const date of dates) {
      const page = await browser.newPage();
      await loginAndSelectDate(page, date);
      await clickSummaryVescLinks(page, browser, date); 
    }

  } catch (err) {
    console.error('An error occurred:', err);
  }
}

main();


