const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs/promises'); 

const rl = readline.createInterface({ 
  input: process.stdin,
  output: process.stdout
});

const websiteUrl = 'https://www.pdsadm.com/PAnet/Account/Login';
const cessionUrl = 'https://www.pdsadm.com/PAnet/Common/CessionStatements';
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
  const { pdfNamesAndUrls } = await page.$$eval('tr.ng-scope', (rows, date) => {
    function formatDateForURL(date) {
      let year = date.getFullYear();
      let month = date.toLocaleString('default', { month: 'long' });
      return `${year}-${pad(date.getMonth() + 1)}%20${month}%20${year}`;
    }

    let pdfNamesAndUrls = rows.map(row => {
      let pdfName = row.querySelector('span.ng-binding').textContent;
      let urlDatePart = formatDateForURL(date);
      let pdfUrl = `https://www.pdsadm.com/PDSReports/PORC191104/Reports/Combined/${urlDatePart}/${pdfName}`;
      return { pdfName, pdfUrl };
    }).filter(({ pdfName }) => pdfName.endsWith('.pdf'));

    return { pdfNamesAndUrls };
  }, date);

  return pdfNamesAndUrls;
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
