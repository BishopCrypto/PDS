const fs = require('fs/promises');
const fsnp = require('fs');
const puppeteer = require('puppeteer');
const readline = require('readline');
const Papa = require('papaparse');
const axios = require('axios');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const { PDFDocument } = require('pdf-lib');
const websiteUrl = 'https://www.pdsadm.com/PAnet/Account/Login';

let args = process.argv;

function showsHelp(){
    console.error(`Usage: node ./index.js <type> <start_date> [end_date] \n\n'Type' can be 'cession' or 'trust'.\n End Date is optional.`);
    console.error('Example: node ./index.js trust 202309 202312');
    console.error('Example: node ./index.js cession 202309');
    process.exit(1);
}

if (args.length == 0) {
    showsHelp();
}

const masterUser = 'RALPDS',
    masterPw = 'reinsassoc';

let type = args[2];
if (type !== 'cession' && type!=='trust')
    showsHelp();

const year_month_list = []
let startDate, endDate;

function isValidDate(dateString) {
    const timestamp = Date.parse(dateString);
    return !isNaN(timestamp);
}

if (args.length >= 4) {
    if (isValidDate(args[3].substring(4))){
        const [startMonth, startYear] = [Number(args[3].substring(4)), Number(args[3].substring(0, 4))];
        startDate = new Date(startYear, startMonth - 1);
    } else {
        showsHelp();
    }
}
if (args.length >= 5) {
    if (isValidDate(args[4].substring(4))){
        const [endMonth, endYear] = [Number(args[4].substring(4)), Number(args[4].substring(0, 4))];
        endDate = new Date(endYear, endMonth - 1);
    } else {
        showsHelp(); 
    }
} else {
    const [startMonth, startYear] = [Number(args[3].substring(4)), Number(args[3].substring(0, 4))];
    endDate = new Date(startYear, startMonth - 1);
}

for (let date = startDate; date <= endDate; date.setMonth(date.getMonth() + 1)) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const dString = `${year}${month}`;
    year_month_list.push(dString);
}

const filePath = type=='cession' ? './filter_cessions.csv' : './filter_trusts.csv';
const csv = require('csv-parser');

const results = [];
const filters = []
fsnp.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
        // Process the data here
        results.map(record => {
            if (record['To be uploaded'] == 'YES') {
                filters.push(record)
            }
        })
    });

async function getUserAccessKey() {
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

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
    });
    page.setDefaultNavigationTimeout(0);

    console.log('Going to website URL...');
    await page.goto(websiteUrl, { waitUntil: 'load', timeout: 0 });
    // await page.waitForTimeout(2000); // Wait for 2 seconds

    console.log('Typing username...');
    await page.type('#UserName', masterUser);

    console.log('Typing password...');
    await page.type('#Password', masterPw);

    console.log('Clicking login button...');
    await page.click('#LoginButton');

    console.log('Adding delay for page load...');
    await page.waitForTimeout(2000); // Wait for 2 seconds

    const userAccessKey = await page.evaluate((id) => {
        return document.getElementById(id).value;
    }, 'UserAccessKey');

    await browser.close();

    return userAccessKey;
}


function findURLs(data) {
    const URLs = [];

    function traverse(node) {
        if (node.URL && node.URL != "") {
            if (URLs.indexOf(node.URL) == -1) {
                URLs.push(node.URL);
            }
        }

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                traverse(child);
            }
        }
    }
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        traverse(item);
    }
    return URLs;
}

async function fetchData(url) {
    try {
        const response = await axios.get(url);
        return findURLs(response.data.d)
    } catch (error) {
        console.error(error);
    }

    return [];
}
const stringContainsPattern = (inputString) => {
    const pattern = /20\d{2}_\d{2}/; // Regular expression pattern

    return pattern.test(inputString);
};

function isValidDateFormat(str) {
    // Check if the string matches the regular expression
    if (!/^\d{4}-\d{2}$/.test(str)) {
      return false;
    }
  
    // Try to parse the string as a date
    const date = Date.parse(str);
  
    // Check if the date is valid
    return !isNaN(date);
}

let processedCount = 1
async function downloadPdf(url, ym, type = 'cession') {
    try {

        console.log(url)
        const parts = url.split('/');
        const pdsClientCode = parts[2];
        const directory = parts[4];
        const downloadDirectory = parts[5];
        const productCodeInUrl = parts[6].replace('.pdf', '');

        let isCorrect = false;
        
        for (let i = 0; i < filters.length; i++) {
            const filter = filters[i];
            if (type == 'cession')
            {
                const clientCode = filter['PDS Client Code'];
                const clientName = filter['Client Name'];
                const productCode1 = filter['PDS Product Code1'];
                const productCode2 = filter['PDS Product Code2'];
                const cessionId = filter['Cession ID'];

                if (pdsClientCode == clientCode && (productCodeInUrl.indexOf(productCode1) != -1 || productCodeInUrl.indexOf(productCode2) != -1)) {
                    isCorrect = true;
                    break;
                }
            } else if (type == 'trust') {
                const clientCode = filter['PDS Client Code'];
                const clientName = filter['Client Name'];
                const bank = filter['Bank'];
                const partsfromUrl = productCodeInUrl.split(' ');
                const dateYM = partsfromUrl[3];
                if (!isValidDateFormat(dateYM)) dateYM = partsfromUrl[4];

                if (pdsClientCode == clientCode) {
                    const year = ym.slice(0, 4);
                    const month = ym.slice(4);
                    const yearMonthStr = `${year}-${month}`;
                    if (dateYM == yearMonthStr) {
                        isCorrect = true;
                        break;
                    }
                }
            }
        }

        if (isCorrect) {
            
            let dir = '';
            if (type == 'cession') {
                let filename = `${pdsClientCode}_${productCodeInUrl}`;
                filename = filename.replace('-', '_');
                filename = filename.replace(' ', '_');
                dir = `./uploader/to_be_uploaded`;
                await fs.mkdir(dir, { recursive: true });
                const response = await axios.get(`https://www.pdsadm.com/${url}`, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');
                const pdfDoc = await PDFDocument.load(buffer);
                const pageCount = pdfDoc.getPageCount();
                const pdfDocSingle = await PDFDocument.create();
                const [copiedPage] = await pdfDocSingle.copyPages(pdfDoc, [pageCount - 1]);
                pdfDocSingle.addPage(copiedPage);
                const pdfBytesSingle = await pdfDocSingle.save();
                await fs.writeFile(`${dir}/cession_${downloadDirectory}_${filename}_last_page.pdf`, pdfBytesSingle);
            } else if (type == 'trust'){
                let filename = `${productCodeInUrl}`;
                filename = filename.replace('-', '_');
                filename = filename.replace(' ', '_');
                const partsfromUrl = productCodeInUrl.split(' ');
                const dateYM = partsfromUrl[3];
                if (!isValidDateFormat(dateYM)) dateYM = partsfromUrl[4];
                
                dir = `./uploader/to_be_uploaded`
                await fs.mkdir(dir, { recursive: true });
                const response = await axios.get(`https://www.pdsadm.com/${url}`, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');
                await fs.writeFile(`${dir}/trust_${dateYM}_${filename}.pdf`, buffer);
            }
            
            processedCount++;
            console.log(processedCount)
        }
    } catch (error) {
        return '';
    }
}

async function main() {
    const uak = 66285;
    
    let directories = [];

    let skipped_urls = [];
    for (let i = 0; i < year_month_list.length; i++) {
        const ym = year_month_list[i];
        
        let m_urls;
        if (type == 'cession') {
            m_urls = await fetchData(`https://www.pdsadm.com/PAnet/json.svc/GetCessionTree?u=${uak}&d=${ym}`);
            directories = [
                'Texas GAP', 'GAP', 'PPM', 'Protection', 'TheftDeterrent', 'VscRefund', 'Dimension', 'Service Contracts'
            ];
        } else if (type == 'trust') {
            m_urls = await fetchData(`https://www.pdsadm.com/PAnet/json.svc/GetTrustTree?u=${uak}&d=${ym}`);
            directories = [
                'Texas GAP', 'GAP', 'PPM', 'Protection', 'TheftDeterrent', 'VscRefund', 'Dimension', 'Service Contracts', 'Trust Account Statements'
            ];
        }

        for (let idx = 0; idx < m_urls.length; idx++) {
            const parts = m_urls[idx].split('/');

            if (directories.indexOf(parts[4]) == -1) {
                skipped_urls = [...skipped_urls, m_urls[idx]];
                continue;
            }

            await downloadPdf(m_urls[idx], ym, type);
        }
    }

    console.log('Done')
    const content = skipped_urls.join('\n');
    fs.writeFile('SkippedUrls.txt', content, error => {
        console.log(error)
    });
}

main();
