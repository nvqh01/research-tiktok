import { appendFileSync } from "fs";
import _ from "lodash";
import {
  DEFAULT_HEADERS_FOR_SOURCE,
  DEFAULT_PARAMS_FOR_SOURCE,
  ENDPOINT_FOR_SOURCE,
  PROXIES_FOR_SOURCE,
  USER_IDS,
} from "./contants.mjs";
import { InputManager } from "./input-manager.mjs";
import { ProxyManager } from "./proxy-manager.mjs";
import { SourceWorker } from "./worker.mjs";

const INDEX = 1;
const MAX_PROCESSED_REQUESTS = 100;
const TOTAL_PROXIES = 10;
const TOTAL_INPUTS = 1000;

start(INDEX);

async function start(index) {
  console.log(`Kịch bản ${index}...`);

  const { listInputs, listProxies, proxyPendingTimes, workerOptions } =
    getOptions(index);

  const inputManager = new InputManager(listInputs);
  const proxyManager = new ProxyManager(listProxies, proxyPendingTimes);

  const worker = new SourceWorker(workerOptions, inputManager, proxyManager);
  await worker.start();

  const statistics = worker.getStatistics();

  appendFileSync(
    `reports/source/index_${index}.txt`,
    JSON.stringify(statistics, null, 2) +
      "\n===============================================================\n\n"
  );
}

function getOptions(index) {
  let listProxies;
  let proxyPendingTimes;
  let workerOptions = {
    endpoint: ENDPOINT_FOR_SOURCE,
    headers: DEFAULT_HEADERS_FOR_SOURCE,
    params: DEFAULT_PARAMS_FOR_SOURCE,

    concurrency: 1,
    maxRetries: 5,
    maxProcessedRequests: MAX_PROCESSED_REQUESTS,
    processId: index,
  };

  const proxies = PROXIES_FOR_SOURCE.splice(0, TOTAL_PROXIES);

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
    // - Thời gian nghỉ: 3 phút
    case 2:
      {
        listProxies = [proxies[1]];
        proxyPendingTimes = 3 * 60 * 1000;
      }
      break;

    // Kịch bản 3:
    // - Số lượng proxy: 1
    // - Thời gian nghỉ: 5 phút
    case 3:
      {
        listProxies = [proxies[2]];
        proxyPendingTimes = 5 * 60 * 1000;
      }
      break;
  }

  return {
    listInputs: USER_IDS.splice(0, TOTAL_INPUTS).map((userId) => {
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
