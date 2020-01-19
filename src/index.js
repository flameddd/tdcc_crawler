const fs = require("fs");
const path = require('path')
const puppeteer = require('puppeteer');
const { TARGET_DATE, STOCK_NO, STOCK_NO_TEST } = require('./constant')

const SLEEP_SECOND = 5;
const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms));
const missTarget = []

async function main() {
  try {
    console.time('執行時間');
    const outcomePath = 'outcome'; // 輸出路徑
    const targetURL = 'https://www.tdcc.com.tw/smWeb/QryStock.jsp';
    const isNeedFormat = false; // 輸出的檔案是否要「插入分隔符號」
    const defaultSeparator = '___'; // 預設分隔符號（資料內容有逗點(「,」)，所以這邊無法用逗點來當預設，會混淆。

    let writeStream = null;
    let processCount = 0;
    
    const targetDataNumber = STOCK_NO.length * TARGET_DATE.length
    console.log(`預期爬的資料筆數: ${targetDataNumber}`)
    console.log(`是否需要插入 separator 來 fotmat 輸出內容：${isNeedFormat}`)
    console.log(`每筆資料查詢間隔時間: ${SLEEP_SECOND} 秒`);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    // 讀取頁面，直到沒有下載了
    await page.goto(targetURL, { waitUntil: 'networkidle0' });

    for (const targetStockNo of STOCK_NO) {
      for (const targetDate of TARGET_DATE) {
        processCount = processCount + 1;

        // 輸出檔名格式：targetStockNo_targetDate.txt
        const fileName = `${targetStockNo}_${targetDate}`;
        const filePath = path.join(outcomePath, `${fileName}.txt`)
        if (fs.existsSync(filePath)) {
          console.log(`${processCount}/${targetDataNumber} ${fileName} 資料已存在，跳過抓取。`)
        } else {
          await sleep(SLEEP_SECOND * 1000);

          // 用 id 找頁面上的 element 並且輸入 stockNo, date
          await page.type('#StockNo', targetStockNo);
          await page.select('#scaDates', targetDate)

          console.log(`查詢股票代碼: ${targetStockNo}, 日期: ${targetDate}`)
          await Promise.all([
            page.click('input[name="sub"]'),
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
          ]);

          let { title, content } = await page.evaluate(() => {
            const tables = Array
              .from(document.querySelectorAll('table')) //抓取所有畫面上的 table element
              .map(td => td.innerText)
            return {
              title: tables[6], // 人工判斷我們要的 data 是第 6, 7 個 table element
              content: tables[7],
              tables,
            }
          });

          if (content.includes('無此資料')) {
            missTarget.push(`股票代碼: ${targetStockNo}, 日期: ${targetDate}`)
            console.log(`${processCount}/${targetDataNumber} 股票代碼: ${targetStockNo}, 日期: ${targetDate} 無此資料`)
          } else {
            if (isNeedFormat) {
              // 把「tab 空格」替換成 defaultSeparator
              title = title
                .replace(/\u00a0\u00a0\u00a0\u00a0/g, defaultSeparator)
                .replace(/\t/g, defaultSeparator);
              content = content.replace(/\t/g, defaultSeparator)
            }

            fs.mkdir(`./${outcomePath}`, { recursive: true }, (err) => {
              if (err) throw err;
            });

            console.log(`${processCount}/${targetDataNumber} 存入資料 -> 股票代碼: ${targetStockNo}, 日期: ${targetDate} (路徑：${filePath})`)

            writeStream = fs.createWriteStream(filePath)
            writeStream.write(title)
            writeStream.write(content)
          }
        }
      }
    }
  
    await browser.close();
    console.log(`查無資料 or 讀取失敗的資料比數: ${missTarget.length}`)
    if (missTarget.length) {
      console.error(missTarget)
    }
    console.timeEnd('執行時間');
  } catch (error) {
    console.error(error)
  }
}

main();