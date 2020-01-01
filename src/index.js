const fs = require("fs");
const path = require('path')
const puppeteer = require('puppeteer');

(async () => {
  try {
    const outcomePath = 'outcome'; // 輸出路徑
    const targetURL = 'https://www.tdcc.com.tw/smWeb/QryStock.jsp';
    const isNeedFormat = false; // 輸出的檔案是否要「插入分隔符號」
    const defaultSeparator = '___'; // 預設分隔符號（資料內容有逗點(「,」)，所以這邊無法用逗點來當預設，會混淆。

    const targetStockNo = '2330'; // 要設定的股票代碼
    const targetDate = '20191227' // 針對哪個日期

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    // 讀取頁面，直到沒有下載了
    await page.goto(targetURL, { waitUntil: 'networkidle0' });

    // 用 id 找頁面上的 element 並且輸入 stockNo, date
    await page.type('#StockNo', targetStockNo);
    await page.select('#scaDates', targetDate)

    console.log(`查詢股票代碼: ${targetStockNo}, 日期: ${targetDate}`)
    console.log('等待中...')
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
      }
    });

    console.log(`是否需要插入 separator 來 format 輸出內容：${isNeedFormat}`)
    if (isNeedFormat) {
      // 把「tab 空格」替換成 defaultSeparator
      title = title
        .replace(/\u00a0\u00a0\u00a0\u00a0/g, defaultSeparator)
        .replace(/\t/g, defaultSeparator);
      content = content.replace(/\t/g, defaultSeparator)
    }

    const now = new Date();
    // 輸出檔名格式：stockNo(targetDate)-年_月_日_小時_分_秒.txt
    const fileName = `${targetStockNo}(${targetDate})-${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}_${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}`;

    fs.mkdir(`./${outcomePath}`, { recursive: true }, (err) => {
      if (err) throw err;
    });

    const writeStream = fs
      .createWriteStream(path.join(outcomePath, `${fileName}.txt`))
    writeStream.write(title)
    writeStream.write(content)

    console.log(`輸出位置: ${path.join(outcomePath, `${fileName}.txt`)}`)
  
    await browser.close(); 
  } catch (error) {
    console.error(error)
  }
})();
