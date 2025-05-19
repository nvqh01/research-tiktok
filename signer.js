/* eslint-disable */
import { createCipheriv } from 'crypto';
import { devices, chromium } from 'playwright-chromium';
import Utils from './utils.js';
const iPhone11 = devices['iPhone 11 Pro'];

import path from 'path';
import { fileURLToPath } from 'url';

class Signer {
  userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
  args = [
    '--disable-blink-features',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--window-size=1920,1080',
    '--start-maximized',
  ];
  // Default TikTok loading page
  default_url = 'https://www.tiktok.com/@1/video/1';

  // Password for xttparams AES encryption
  password = 'webapp1.0+202106';

  constructor(default_url, userAgent, browser) {
    if (default_url) {
      this.default_url = default_url;
    }
    if (userAgent) {
      this.userAgent = userAgent;
    }

    if (browser) {
      this.browser = browser;
      this.isExternalBrowser = true;
    }

    this.args.push(`--user-agent='${this.userAgent}'`);

    this.options = {
      headless: true,
      args: this.args,
      ignoreDefaultArgs: ['--mute-audio', '--hide-scrollbars'],
      ignoreHTTPSErrors: true,
    };
  }

  async init() {
    // Get the directory name of the current module
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    if (!this.browser) {
      this.browser = await chromium.launch(this.options);
    }

    let emulateTemplate = {
      ...iPhone11,
      locale: 'en-US',
      deviceScaleFactor: Utils.getRandomInt(1, 3),
      isMobile: Math.random() > 0.5,
      hasTouch: Math.random() > 0.5,
      userAgent: this.userAgent,
    };
    emulateTemplate.viewport.width = Utils.getRandomInt(320, 1920);
    emulateTemplate.viewport.height = Utils.getRandomInt(320, 1920);

    this.context = await this.browser.newContext({
      bypassCSP: true,
      ...emulateTemplate,
    });

    this.page = await this.context.newPage();

    await this.page.route('**/*', (route) => {
      return route.request().resourceType() === 'script'
        ? route.abort()
        : route.continue();
    });

    await this.page.goto(this.default_url, {
      waitUntil: 'networkidle',
    });

    let LOAD_SCRIPTS = ['webmssdk.js',];

    LOAD_SCRIPTS.forEach(async (script) => {
      await this.page.addScriptTag({
        path: path.resolve(__dirname, 'javascript', script),
      });
      console.log('[+] ' + script + ' loaded');
    });

     await this.page.evaluate(() => {
      /* window.generateSignature = function generateSignature(url) {
        if (typeof window.byted_acrawler.sign !== 'function') {
          throw 'No signature function found';
        }
        return window.byted_acrawler.sign({ url });
      };

      window.generateBogus = function generateBogus(params) {
        if (typeof window.generateBogus !== 'function') {
          throw 'No X-Bogus function found';
        }
        return window.generateBogus(params);
      }; */

      window.generateSignature = function generateSignature(url, body) {
        if (typeof window._yg[37] !== 'function') {
          throw 'No X-Bogus/X-Gnarly function found';
        }

        console.log({
          yg37: window._yg[37],
          url,
          body
        })
        return window._yg[37](url, body);
      };

      return this;
    });
  }

  async getCookies() {
    const cookies = await this.page.context().cookies();
    return cookies;
  }

  async navigator() {
    // Get the 'viewport' of the page, as reported by the page.
    const info = await this.page.evaluate(() => {
      return {
        deviceScaleFactor: window.devicePixelRatio,
        userAgent: window.navigator.userAgent,
        browser_language: window.navigator.language,
        browser_platform: window.navigator.platform,
        browser_name: window.navigator.appCodeName,
        browser_version: window.navigator.appVersion,
      };
    });
    return info;
  }

  async Sign(url, body = '') {
    
    console.log('Sign', { e: url, t: body });
    return await this.page.evaluate(`generateSignature('${url}', ${body})`);
  }

  async signDepercated(link) {

    // await this.page.evaluate('setMsToken("xdFakeOne")'); // Fake set msToken function
    // generate valid verifyFp
    // let verify_fp = Utils.generateVerifyFp();
    // let newUrl = link + '&verifyFp=' + verify_fp;

    let signature = await this.page.evaluate(`generateSignature('${link}')`);
    let signedUrl = link + '&_signature=' + signature;

    let queryString = new URL(signedUrl).searchParams.toString();

    // let bogus2 = xbogus(queryString, this.userAgent)

    let bogus = await this.page.evaluate(`generateBogus('${queryString}','${this.userAgent}')`);
    let msToken = ''; // await this.page.evaluate('retrieveMsToken()');
    signedUrl += '&X-Bogus=' + bogus;

    // console.log({ bogus, bogus2 })

    return {
      msToken,
      bogus,
      signature,
      // verify_fp,
      signedUrl,
      'x-tt-params': this.xttparams(queryString),
      'x-bogus': bogus,
    };
  }

  xttparams(query_str) {
    query_str += '&is_encryption=1';

    // Encrypt query string using aes-128-cbc
    const cipher = createCipheriv('aes-128-cbc', this.password, this.password);
    return Buffer.concat([cipher.update(query_str), cipher.final()]).toString(
      'base64'
    );
  }

  async close() {
    if (this.browser && !this.isExternalBrowser) {
      await this.browser.close();
      this.browser = null;
    }
    if (this.page) {
      this.page = null;
    }
  }
}

export default Signer;
