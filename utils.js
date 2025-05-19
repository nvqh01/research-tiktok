
/* eslint-disable */
import { HttpsProxyAgent } from 'https-proxy-agent';

class Utils {
  static proxy(country) {
    const proxy = {
      host: 'tun.netsocks.io',
      port: 22225,
      auth: {
        username: 'nts-customer-zp_390cebac-zone-residential_ben-country-BR',// `${config.proxy.username}`,
        password: 'test' // config.proxy.password
      }
    };
  
    // Construct proxy URL
    const proxyUrl = `https://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
  
    // Create an instance of ProxyAgent with the proxy URL
    // const httpsAgent = new HttpsProxyAgent(proxyUrl);
     
    const httpsAgent = new HttpsProxyAgent(`http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`);

    return { httpsAgent };
  }

  static getRandomInt(a, b) {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const diff = max - min + 1;
    return min + Math.floor(Math.random() * Math.floor(diff));
  }

  static generateVerifyFp() {
    // return 'verify_lvzx7ekg_2rbbCJeM_Lm1j_4nNU_9RRX_4a9U0iUyARKp'
    // return 'verify_5b161567bda98b6a50c0414d99909d4b'; // !!! NOT SURE IF EXPIRE
    var e = Date.now();
    var t = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(
        ''
      ),
      e = t.length,
      n = Date.now().toString(36),
      r = []; 
    (r[8] = r[13] = r[18] = r[23] = '_'), (r[14] = '4');
    for (var o = 0, i = void 0; o < 36; o++)
      r[o] ||
        ((i = 0 | (Math.random() * e)), (r[o] = t[19 == o ? (3 & i) | 8 : i]));
    return 'verify_' + n + '_' + r.join('');
  }

  static extractCooks(headers) {
    // Check if the headers contain the 'sessionid' cookie
    const cookies = headers['set-cookie'] || [];
  
    // eslint-disable-next-line no-restricted-syntax
    for (const cookie of cookies) {
      const splited = cookie.split(';');
      const name   = splited[0].split('=')[0];
  
      if (name === 'sessionid') {
        const sessionId   = splited[0].split('=')[1];
        const maxAgeSeconds = splited[3].split('=')[1];
  
        const currentDate = new Date();
  
        const maxAge = new Date(currentDate.getTime() + (parseInt(maxAgeSeconds, 10) * 1000));
  
        return { sessionId, maxAge };
      }
    }
    return {};
  }

  static canRequestMore(requestedBefore) {
    const currentTime = new Date();
    const fiveMinutesAgo = new Date(currentTime.getTime() - 5 * 60 * 1000); // 5 minutes ago

    // Filter requests made within the last 5 minutes
    const recentRequests = requestedBefore.filter(item => new Date(item.createdAt) >= fiveMinutesAgo);

    // Check if there have been fewer than 5 requests in the last 5 minutes
    return recentRequests.length < 5;
  }

  static generateDeviceId(length = 19) {
    let deviceId = '';
  
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < length; i++) {
      deviceId += Math.floor(Math.random() * 10);
    }
    return deviceId;
  }

  static getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  static generateAgent() {

    const languages = ['en', 'es', 'fr', 'de', 'it'];
    const regions = ['AR', 'US', 'GB', 'DE', 'FR', 'IT'];
    const osOptions = ['windows', 'mac', 'linux'];
    const platforms = ['Win32', 'Win64', 'MacIntel', 'Linux x86_64'];

    const app_language = this.getRandomElement(languages);
    const browser_language = `${app_language}-${this.getRandomElement(['US', 'GB', 'DE', 'FR', 'IT'])}`;
    const browser_name = this.getRandomElement(['Mozilla', 'Chrome', 'Safari', 'Edge', 'Opera']);
    const browser_online = Math.random() < 0.5 ? 'true' : 'false';
    const browser_platform = this.getRandomElement(platforms);
    const browser_version = `${this.getRandomInt(1, 100)}.0 (${browser_platform}) AppleWebKit/${this.getRandomInt(500, 600)}.36 (KHTML, like Gecko) Chrome/${this.getRandomInt(70, 125)}.0.0.0 Safari/${this.getRandomInt(500, 600)}.36`;
    const os = this.getRandomElement(osOptions);
    const region = this.getRandomElement(regions);
    const screen_height = this.getRandomInt(720, 2160).toString();
    const screen_width = this.getRandomInt(1280, 3840).toString();

    return {
      app_language,
      browser_language,
      browser_name,
      browser_online,
      browser_platform,
      browser_version,
      os,
      region,
      device_id: this.generateDeviceId(),
      screen_height: screen_height.toString(),
      screen_width: screen_width.toString()
    };
  }

  static processURL(url) {
    // Normalize the URL to ensure consistency
    if (url.includes('&amp;')) {
      url = url.replace(/&amp;/g, '&');
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const urlObj = new URL(url);

    // 1) Check for TikTok share comment parameters
    const shareAwemeId   = urlObj.searchParams.get('share_item_id');
    const shareCommentId = urlObj.searchParams.get('share_comment_id');
    if (shareAwemeId && shareCommentId) {
      return {
        kind:      'comment',
        awemeId:   shareAwemeId,
        commentId: shareCommentId
      };
    }

    const pathParts = urlObj.pathname.split('/').filter(part => part);
    
    if (pathParts.length === 1 && pathParts[0].startsWith('@')) {
      const username = pathParts[0].substring(1);
      return { kind: 'profile', value: username };
    }

    console.log(pathParts)
    if (pathParts.length >= 3 && pathParts[0].startsWith('@')) {
      const username = pathParts[0].substring(1);
      const contentType = pathParts[1];
      const contentId = pathParts[2];

      if ((contentType === 'video' || contentType === 'photo') && contentId) {
        return { kind: 'post', username, value: contentId };
      }
    }

    return { kind: 'unknown', value: null };
  }

  static parseCookies(cookieArray) {
    return cookieArray
      .map(cookie => cookie.split(';')[0]) // Get only the name=value part
      .join('; '); // Join them with "; "
  }
}

export default Utils;