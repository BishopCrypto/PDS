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
// console.log(process.argv)
args = ['', '', 'trust','202309']

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

console.log(args.length)

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
    endDate = new Date();
    endDate.setMonth(endDate.getMonth() - 1);
}

for (let date = startDate; date <= endDate; date.setMonth(date.getMonth() + 1)) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const dString = `${year}${month}`;
    year_month_list.push(dString);
}

console.log(year_month_list)

const filePath = './filter.csv';
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
            //console.log(filters);
    });
// return;
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
let ttcount = 0
async function downloadPdf(url, ym, type = 'cession') {
    try {
        console.log('Fetching: ', url);

        const parts = url.split('/');

        let isCorrect = false;
        for (let i = 0; i < filters.length; i++) {
            let a = parts[2];
            let b = filters[i]['PDS Client Code'];
            let c = parts[6];
            let d = filters[i]['PDS Product Code'];
            // console.log(a, b, c, d)
            if (type == 'cession') {
                c = c.replace('.pdf', '').replace('-', '').replace(' ', '').replace('_', '')
                d = d.replace('-', '').replace(' ', '').replace('_', '')
                if (a == b && c == d) {
                    isCorrect = true;
                    break;
                }
            } else {
                if (a == b) {
                    const year = ym.slice(0, 4);
                    const month = ym.slice(4);
                    
                    const str = `${year}-${month}`;
                    if (c.indexOf(str) !== -1)
                    // if (c.indexOf(d) !== -1 && c.indexOf(str) !== -1)
                        isCorrect = true;                        
                        break;
                    }
            }
            
        }

        if (isCorrect) {
            ttcount++;
            console.log(ttcount)
            let dir = `./downloads/${parts[5]}`;
            if (type == 'cession') {
                dir = `./downloads/cession/${parts[5]}`
            } else if (type == 'trust'){
                let sub_parts = parts[6].split(' ');
                let sub_dir = '';
                for (let i = 0; i < sub_parts.length; i++) {
                    if (stringContainsPattern(sub_parts[i])) {
                        sub_dir = sub_parts[i]
                        break

                    }
                }
                dir = `./downloads/trust/${parts[5]}/${sub_dir}/`
            }
            await fs.mkdir(dir, { recursive: true });
            let filename = `${parts[2]}_${parts[6]}`;
            filename = filename.replace('-', '_');
            filename = filename.replace(' ', '_');
            filename = filename.replace('.pdf', '');

            const response = await axios.get(`https://www.pdsadm.com/${url}`, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            // await fs.writeFile(`${dir}/${filename}_tmp`, buffer);

            if (type == 'cession') {
                const pdfDoc = await PDFDocument.load(buffer);
                const pageCount = pdfDoc.getPageCount();
                const pdfDocSingle = await PDFDocument.create();
                const [copiedPage] = await pdfDocSingle.copyPages(pdfDoc, [pageCount - 1]);
                pdfDocSingle.addPage(copiedPage);
                const pdfBytesSingle = await pdfDocSingle.save();
                await fs.writeFile(`${dir}/${filename}_last_page.pdf`, pdfBytesSingle);
                // console.log(`${dir}/${filename}_last_page.pdf`);
            } else {
                await fs.writeFile(`${dir}/${filename}.pdf`, buffer);
            }
        }
    } catch (error) {
        return '';
    }
}

async function main() {
    const uak = await getUserAccessKey();
    console.log(uak)

    let directories = [
        'Texas GAP', 'GAP', 'PPM', 'Protection', 'TheftDeterrent', 'VscRefund', 'Dimension', 'Service Contracts', 'Trust Account Statements'
    ];

    let skipped_urls = [];
    for (let i = 0; i < year_month_list.length; i++) {
        const ym = year_month_list[i];
        // console.log(`https://www.pdsadm.com/PAnet/json.svc/GetCessionTree?u=${uak}&d=${ym}`);
        // console.log(`https://www.pdsadm.com/PAnet/json.svc/GetTrustTree?u=${uak}&d=${ym}`);
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