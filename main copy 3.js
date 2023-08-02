const fs = require('fs/promises');
const puppeteer = require('puppeteer');
const readline = require('readline');


const rl = readline.createInterface({ 
  input: process.stdin,
  output: process.stdout
});

const websiteUrl = 'https://www.pdsadm.com/PAnet/Account/Login';
const cessionUrl = 'https://www.pdsadm.com/PAnet/Common/CessionStatements';
const baseUrl = 'https://www.pdsadm.com/';

const username = 'PORC210103rm';
const password = 'reinsassoc';

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

  const baseUrl = 'https://www.pdsadm.com/PDSReports/PORC191104/Reports/Combined';

  for (const span of spans) {

    const name = await span.evaluate(el => el.textContent);

    if (!name.endsWith('.pdf')) continue;
    
    const datePart = getDatePart(date);

    const encodedName = encodeURIComponent(name);
    
    const url = `${baseUrl}/${datePart}/${encodedName}`;

    pdfs.push({
      name,
      url
    });

  }

  return pdfs;

}

function getDatePart(date) {

  // Format date

  return datePart;

}

async function downloadPdf(page, pdf) {

  const response = await page.goto(pdf.url);

  const buffer = await response.buffer(); 

  await fs.writeFile(pdf.name, buffer);

}

function formatDateForURL(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.toLocaleString('default', { month: 'long' });
  return `${year}-${pad(date.getMonth() + 1)}%20${month}%20${year}`;
}

async function main() {
  const browser = await puppeteer.launch({headless: false});

  const datesArg = process.argv[2];
  let dates;
  if (datesArg) {
    dates = datesArg.split(' ').map(dateStr => {
      const [month, year] = dateStr.split('/');
      return new Date(year, month - 1);
    });

  } else {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    dates = [date];
  }

  for (const date of dates) {
    const page = await browser.newPage();
    await loginAndSelectDate(page, date);
    const urls = await getPdfNamesAndUrls(page, date);
    for (const url of urls) {
      console.log(url);
    }
    await page.close();
  }
}

main();
