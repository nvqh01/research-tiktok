import signBogus from "./encryption/xbogus.mjs";
import signGnarly from "./encryption/xgnarly.mjs";
import { appendFileSync } from "fs";
import { gotScraping } from "got-scraping";
import _ from "lodash";
import moment from "moment";
import axios from "axios";

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Worker {
  constructor(options, inputManager, proxyManager) {
    // console.log(options);
    // process.exit(0);

    this.options = options;
    this.inputManager = inputManager;
    this.proxyManager = proxyManager;

    this.statistics = {
      processId: options.processId,
      country: options.country,
      startAt: moment().unix(),
      endAt: moment().unix(),
      totalProcessedRequests: 0,
      totalInputs: this.inputManager.getTotal(),
      totalProxies: this.proxyManager.getTotal(),
      totalCrawledPosts: 0,
    };

    this.ttwid = null;
  }

  async buildUrl(input, nextPageToken) {
    throw new Error('Please implement method "buildUrl"');
  }

  async crawl(input) {
    let isBlocked = false;
    let retries = 0;

    while (true) {
      if (isBlocked) {
        return { posts: [], nextPageToken: null, isBlocked };
      }

      let proxy;

      try {
        proxy = this.proxyManager.getProxy();
        if (!proxy) {
          throw new Error("Can not get proxy");
        }

        // if (!input.ttwid) {
        //   const result = await this.getTtwid(input.input);
        //   result && (input.ttwid = result.ttwid);
        //   // result && (this.ttwid = result.ttwid);
        // }

        const url = await this.buildUrl(
          input.input,
          input.nextPageToken,
          input.msToken
        );
        // console.log(url);
        const response = await this.request(url, proxy, input.ttwid);

        const msToken = response.headers["x-ms-token"];
        input.msToken = msToken;

        const status = response.statusCode;
        if (status !== 200) throw new Error(`Received status ${status}`);

        const body = response.body;
        if (!body || body === '""') throw new Error("Body is empty");

        const data = JSON.parse(body);
        // appendFileSync("data.json", JSON.stringify(data, null, 2) + "\n\n");

        const posts = this.getPosts(data);
        const nextPageToken = this.getNextPageToken(data);

        this.proxyManager.markSuccessProxy(proxy);

        if (!this.isValidNextPageToken(nextPageToken)) {
          return { posts, nextPageToken: null };
        }

        return { posts, nextPageToken };
      } catch (error) {
        const errorMessage = error.message;

        if (errorMessage.includes("Can not get proxy")) {
          await sleep(1_000);
          continue;
        }

        console.log(error);

        this.saveErrorLog(errorMessage, proxy);

        if (errorMessage.includes("Body is empty")) {
          this.proxyManager.markBlokedProxy(proxy);
          // await sleep(2 * 60 * 1000);
          // const result = await this.getTtwid(input.input);
          // result && (this.ttwid = result.ttwid);
          // isBlocked = true;
        } else {
          this.proxyManager.markFailProxy(proxy);
        }

        if (retries++ > this.options.maxRetires) {
          return { posts: [], nextPageToken: null };
        }
      }
    }
  }

  getNextPageToken(data) {
    return data.cursor || null;
  }

  getPosts(data) {
    throw new Error('Please implement method "getPosts"');
  }

  getStatistics() {
    this.statistics.endAt = moment().unix();

    return {
      processId: this.statistics.processId,
      country: this.statistics.country,
      start_at: moment(this.statistics.startAt * 1000).toISOString(),
      end_at: moment(this.statistics.endAt * 1000).toISOString(),
      total_times: this.statistics.endAt - this.statistics.startAt + " seconds",
      total_processed_requests: this.statistics.totalProcessedRequests,
      total_inputs: this.statistics.totalInputs,
      total_proxies: this.statistics.totalProxies,
      total_crawled_posts: this.statistics.totalCrawledPosts,

      proxy_statistics: this.proxyManager.getStatistics(),
    };
  }

  async getTtwid(input) {
    try {
      const url = `https://www.tiktok.com/@${input}`;
      // console.log("url: " + url);
      const response = await gotScraping(url, {
        timeout: {
          request: 60000,
        },
        headerGeneratorOptions: {
          browsers: ["firefox"],
          devices: ["desktop"],
          // locales: ["de-DE", "en-US"],
          operatingSystems: ["windows"],
        },
        useHeaderGenerator: true,
      });
      const cookies = response.headers["set-cookie"];
      let ttwid = cookies.find((cookie) => !!cookie.match(/^ttwid=/)) || null;
      ttwid && (ttwid = ttwid.split(";")[0]);
      const msToken = response.headers["x-ms-token"];
      // console.log({ ttwid, msToken });
      return { ttwid, msToken };
    } catch (error) {
      console.log("Fail to get ttwid, because of: " + error.stack);
      return null;
    }
  }

  isValidNextPageToken(nextPageToken) {
    return nextPageToken && nextPageToken !== "-1";
  }

  async process(input) {
    console.log(
      `Process input "${input.input}"${
        input.nextPageToken
          ? ` with next page token "${input.nextPageToken}"`
          : ""
      }`
    );
    const { posts, nextPageToken, isBlocked = false } = await this.crawl(input);

    if (nextPageToken) {
      input.nextPageToken = nextPageToken;
      this.inputManager.unshift(input);
    }

    this.statistics.totalCrawledPosts += posts.length;

    return { posts, isBlocked };
  }

  async request(url, proxy, ttwid) {
    const headers = { ...this.options.headers };
    this.ttwid && (headers.Cookie = this.ttwid);
    ttwid && (headers.Cookie = ttwid);

    // return axios.request({
    //   method: "GET",
    //   url,
    //   headers,
    //   proxyUrl: this.proxyManager.formatProxyUrl(proxy),
    // });

    return await gotScraping(url, {
      headers,
      proxyUrl: this.proxyManager.formatProxyUrl(proxy),
      timeout: {
        request: 60000,
      },
      headerGeneratorOptions: {
        browsers: ["firefox"],
        devices: ["desktop"],
        // locales: ["de-DE", "en-US"],
        operatingSystems: ["windows"],
      },
      useHeaderGenerator: true,
    });
  }

  async signParams(data) {
    const queryString = new URLSearchParams({
      ...data.params,
    }).toString();

    let body = "";

    if (data.body) {
      body = JSON.stringify(data.body);
    }

    const xBogus = signBogus(
      queryString,
      body,
      this.options.headers["user-agent"] || this.options.headers["User-Agent"],
      // config.browser.userAgent,
      Math.floor(Date.now() / 1000)
    );

    const xGnarly = signGnarly(
      queryString, // query string
      body, // POST body
      // config.browser.userAgent, // user-agent
      this.options.headers["user-agent"] || this.options.headers["User-Agent"],
      0, // envcode
      "5.1.1" // version
    );

    return `${data.url}/?${queryString}&X-Bogus=${xBogus}&X-Gnarly=${xGnarly}`;
  }

  saveErrorLog(errorMessage, proxy) {
    throw new Error('Please implement method "saveErrorLog"');
  }

  async start() {
    // console.log("Total inputs: " + this.inputManager.getTotal());
    // console.log("Total proxies: " + this.proxyManager.getTotal());

    let mustStopProcess = false;

    while (true) {
      if (
        this.options.maxProcessedRequests &&
        this.statistics.totalProcessedRequests >=
          this.options.maxProcessedRequests
      ) {
        console.log("Exceed max total requests");
        break;
      }

      if (mustStopProcess) {
        console.log("Stop crawling because there is a blocked proxy...");
        break;
      }

      let inputs = Array.from({ length: this.options.concurrency }).map(() =>
        this.inputManager.getInput()
      );
      inputs = _.compact(inputs);

      if (!inputs.length) {
        console.log("Finish crawling...");
        break;
      }

      await Promise.all(
        inputs.map(async (input) => {
          const { posts, isBlocked } = await this.process(input);
          if (isBlocked) {
            mustStopProcess = true;
          }
          console.log(
            `Finish processing user id "${input.input}" with ${posts.length} crawled posts`
          );
          this.statistics.totalProcessedRequests += 1;
        })
      );
    }
  }
}

export class KeywordWorker extends Worker {
  constructor(options, inputManager, proxyManager) {
    super(options, inputManager, proxyManager);
  }

  getNextPageToken(data) {
    return data.has_more && data.cursor ? data.cursor : null;
  }

  async buildUrl(input) {
    const params = Object.assign({}, this.options.params);
    input.search_id && (params.search_id = input.search_id);
    input.msToken && (params.msToken = input.msToken);
    input.nextPageToken && (params.offset = input.nextPageToken);
    params.keyword = input.input;
    const signedUrl = await this.signParams({
      // body: '' (send only if is used in the request)
      params,
      url: this.options.endpoint,
    });
    return signedUrl;
  }

  getPosts(data) {
    if (!data.data?.length) return [];
    return data.data;
  }

  async process(input) {
    console.log(
      `Process input "${input.input}"${
        input.nextPageToken
          ? ` with next page token "${input.nextPageToken}"`
          : ""
      }`
    );
    const {
      posts,
      nextPageToken,
      isBlocked = false,
      search_id,
      msToken,
    } = await this.crawl(input);

    if (nextPageToken) {
      input.nextPageToken = nextPageToken;
      input.search_id = search_id;
      input.msToken = msToken;
      this.inputManager.unshift(input);
    }

    this.statistics.totalCrawledPosts += posts.length;

    return { posts, isBlocked, search_id, msToken };
  }

  getParamsHeaders(response) {
    return {
      msToken: response.headers["x-ms-token"],
      search_id: response.headers["x-tt-logid"],
    };
  }

  async request(url, proxy) {
    const config = {
      method: "get",
      maxBodyLength: Infinity,
      url: url,
      headers: this.options.headers,
    };
    return await axios.request(config);
  }

  async crawl(input) {
    let isBlocked = false;
    let retries = 0;

    while (true) {
      if (isBlocked) {
        return { posts: [], nextPageToken: null, isBlocked };
      }

      let proxy;

      try {
        proxy = this.proxyManager.getProxy();
        if (!proxy) {
          throw new Error("Can not get proxy");
        }

        const url = await this.buildUrl(input);
        // console.log(url);
        const response = await this.request(url, proxy);
        const { msToken, search_id } = this.getParamsHeaders(response);
        const status = response.status;
        if (status !== 200) throw new Error(`Received status ${status}`);

        const body = response.data;
        if (!body || body === '""') throw new Error("Body is empty");

        const data = body;
        // appendFileSync("data.json", JSON.stringify(data, null, 2) + "\n\n");
        const posts = this.getPosts(data);
        const nextPageToken = this.getNextPageToken(data);

        this.proxyManager.markSuccessProxy(proxy);

        if (!this.isValidNextPageToken(nextPageToken)) {
          return { posts, nextPageToken: null };
        }

        return { posts, nextPageToken, search_id, msToken };
      } catch (error) {
        const errorMessage = error.message;

        if (errorMessage.includes("Can not get proxy")) {
          await sleep(1_000);
          continue;
        }

        console.log(error);

        this.saveErrorLog(errorMessage, proxy);

        if (errorMessage.includes("Body is empty")) {
          this.proxyManager.markBlokedProxy(proxy);
          isBlocked = true;
        } else {
          this.proxyManager.markFailProxy(proxy);
        }

        if (retries++ > this.options.maxRetires) {
          return { posts: [], nextPageToken: null };
        }
      }
    }
  }

  saveErrorLog(errorMessage, proxy) {
    appendFileSync(
      `error_logs/keyword/index_${this.options.processId}.txt`,
      `Time: ${moment().toISOString()} --- Proxy: ${proxy} --- Error: ${errorMessage}\n`
    );
  }
}

export class SourceWorker extends Worker {
  constructor(options, inputManager, proxyManager) {
    super(options, inputManager, proxyManager);
  }

  async buildUrl(input, nextPageToken, msToken) {
    const params = Object.assign({}, this.options.params);
    msToken && (params.msToken = msToken);
    nextPageToken && (params.cursor = nextPageToken);
    params.secUid = input;

    const signedUrl = await this.signParams({
      // body: '' (send only if is used in the request)
      params,
      url: this.options.endpoint,
    });

    return signedUrl;
  }

  getPosts(data) {
    if (!data.itemList?.length) return [];
    return data.itemList;
  }

  saveErrorLog(errorMessage, proxy) {
    appendFileSync(
      `error_logs/source/index_${
        this.options.processId
      }_${this.options.country.replace("-", "_")}.txt`,
      `Time: ${moment().toISOString()} --- Proxy: ${proxy} --- Country: ${
        this.options.country
      } --- Error: ${errorMessage}\n`
    );
  }
}
