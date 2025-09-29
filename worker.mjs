import signBogus from "./encryption/xbogus.mjs";
import signGnarly from "./encryption/xgnarly.mjs";
import { appendFileSync } from "fs";
import { gotScraping } from "got-scraping";
import _ from "lodash";
import moment from "moment";

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
      startAt: moment().unix(),
      endAt: moment().unix(),
      totalProcessedRequests: 0,
      totalInputs: this.inputManager.getTotal(),
      totalProxies: this.proxyManager.getTotal(),
      totalCrawledPosts: 0,
    };
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

        const url = await this.buildUrl(input.input, input.nextPageToken);
        // console.log(url);
        const response = await this.request(url, proxy);

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

  getNextPageToken(data) {
    return data.cursor || null;
  }

  getPosts(data) {
    throw new Error('Please implement method "getPosts"');
  }

  getStatistics() {
    this.statistics.endAt = moment().unix();

    return {
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

  async request(url, proxy) {
    return await gotScraping(url, {
      headers: this.options.headers,
      proxyUrl: this.proxyManager.formatProxyUrl(proxy),
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
      this.options.headers["user-agent"],
      // config.browser.userAgent,
      Math.floor(Date.now() / 1000)
    );

    const xGnarly = signGnarly(
      queryString, // query string
      body, // POST body
      // config.browser.userAgent, // user-agent
      this.options.headers["user-agent"],
      0, // envcode
      "5.1.1" // version
    );

    return `${data.url}/?${queryString}&X-Bogus=${xBogus}&X-Gnarly=${xGnarly}`;
  }

  saveErrorLog(errorMessage, proxy) {
    throw new Error('Please implement method "saveErrorLog"');
  }

  async start() {
    console.log("Total inputs: " + this.inputManager.getTotal());
    console.log("Total proxies: " + this.proxyManager.getTotal());

    let mustStopProcess = false;

    while (true) {
      if (
        this.options.maxProcessedRequests &&
        this.statistics.totalProcessedRequests >= this.options.maxProcessedRequests
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

  async buildUrl(input, nextPageToken) {
    const params = Object.assign({}, this.options.params);
    nextPageToken && (params.offset = nextPageToken);
    params.keyword = input;

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

  async buildUrl(input, nextPageToken) {
    const params = Object.assign({}, this.options.params);
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
      `error_logs/source/index_${this.options.processId}.txt`,
      `Time: ${moment().toISOString()} --- Proxy: ${proxy} --- Error: ${errorMessage}\n`
    );
  }
}
