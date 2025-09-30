import { appendFileSync } from "fs";
import _ from "lodash";
import {
  DEFAULT_HEADERS_FOR_SOURCE,
  DEFAULT_PARAMS_FOR_SOURCE,
  ENDPOINT_FOR_SOURCE,
  PROXIES_BY_COUNTRY,
  PROXIES_FOR_SOURCE,
  USER_IDS,
} from "./contants.mjs";
import { InputManager } from "./input-manager.mjs";
import { ProxyManager } from "./proxy-manager.mjs";
import { SourceWorker } from "./worker.mjs";
import workerpool from "workerpool";

const INDEX = 1;
const MAX_PROCESSED_REQUESTS = 1000;
const TOTAL_PROXIES = 100;
const TOTAL_INPUTS = 1000;

// start(INDEX);

async function start(index = 1, country = "germany") {
  console.log(`Index: ${index} --- Proxy: ${country}`);

  const { listInputs, listProxies, proxyPendingTimes, workerOptions } =
    getOptions(index, country);

  const inputManager = new InputManager(listInputs);
  const proxyManager = new ProxyManager(listProxies, proxyPendingTimes);

  const worker = new SourceWorker(workerOptions, inputManager, proxyManager);
  await worker.start();

  const statistics = worker.getStatistics();

  appendFileSync(
    `reports/source/index_${index}_${country}.txt`,
    JSON.stringify(statistics, null, 2) +
      "\n===============================================================\n\n"
  );
}

function getOptions(index, country) {
  let listProxies;
  let proxyPendingTimes;
  let workerOptions = {
    endpoint: ENDPOINT_FOR_SOURCE,
    headers: DEFAULT_HEADERS_FOR_SOURCE,
    params: DEFAULT_PARAMS_FOR_SOURCE,

    country,

    concurrency: 1,
    maxRetries: 5,
    maxProcessedRequests: MAX_PROCESSED_REQUESTS,
    processId: index,
  };

  const proxies = _.cloneDeep(PROXIES_BY_COUNTRY)[country].splice(
    0,
    TOTAL_PROXIES
  );

  switch (index) {
    // Kịch bản 1:
    // - Số lượng proxy: 1
    // - Thời gian nghỉ: 1 phút
    case 1:
      {
        listProxies = [proxies[0]];
        proxyPendingTimes = 60 * 1000;
      }
      break;

    // Kịch bản 2:
    // - Số lượng proxy: 1
    // - Thời gian nghỉ: 30 giây
    case 2:
      {
        listProxies = [proxies[1]];
        proxyPendingTimes = 30 * 1000;
      }
      break;

    // Kịch bản 3:
    // - Số lượng proxy: 1
    // - Thời gian nghỉ: 1 giây
    case 3:
      {
        listProxies = proxies[2] ? [proxies[2]] : [proxies[1]];
        proxyPendingTimes = 1 * 1000;
      }
      break;

    case 4:
      {
        listProxies = proxies[3] ? [proxies[3]] : [proxies[0]];
        proxyPendingTimes = 30 * 1000;
      }
      break;

    case 5:
      {
        listProxies = proxies[4] ? [proxies[4]] : [proxies[1]];
        proxyPendingTimes = 1 * 1000;
      }
      break;

    case 6:
      {
        listProxies = proxies.slice(0, 50);
        proxyPendingTimes = 1 * 1000;

        workerOptions.concurrency = 10;
      }
      break;
  }

  return {
    listInputs: _.cloneDeep(USER_IDS)
      .splice(0, TOTAL_INPUTS)
      .map((userId) => {
        return {
          input: userId.replace("tt_", "").trim(),
          nextPageToken: "0",
        };
      }),
    listProxies,
    proxyPendingTimes,
    workerOptions,
  };
}

workerpool.worker({
  getOptions,
  start,
});
