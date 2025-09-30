import { LRUCache } from "lru-cache";
import _ from "lodash";

export class ProxyManager {
  constructor(listProxies, ttl = 1000) {
    this.cache = new LRUCache({
      allowStale: false,
      max: 100000,
      ttl,
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });
    this.index = 0;
    this.listProxies = listProxies;
    this.statistics = {};
  }

  formatProxyUrl(proxy) {
    const [host, port, username, password] = proxy.split(":");
    return `http://${username}:${password}@${host}:${port}`;
  }

  markBlokedProxy(proxy) {
    this.statistics[proxy].blocked_requests += 1;
  }

  markFailProxy(proxy) {
    this.statistics[proxy].fail_requests += 1;
  }

  markSuccessProxy(proxy) {
    this.statistics[proxy].success_requests += 1;
  }

  getProxyWithoutCache() {
    if (this.index >= this.listProxies.length) this.index = 0;
    const proxy = this.listProxies[this.index++ % this.listProxies.length];

    if (!this.statistics[proxy]) {
      this.statistics[proxy] = {
        total_requests: 0,
        success_requests: 0,
        fail_requests: 0,
        blocked_requests: 0,
      };
    }

    return proxy;
  }

  getProxy() {
    if (this.index >= this.listProxies.length) this.index = 0;
    const proxy = this.listProxies[this.index++ % this.listProxies.length];

    if (this.cache.has(proxy)) return null;

    if (!this.statistics[proxy]) {
      this.statistics[proxy] = {
        total_requests: 0,
        success_requests: 0,
        fail_requests: 0,
        blocked_requests: 0,
      };
    }

    this.cache.set(proxy, true);
    return proxy;
  }

  getTotal() {
    return this.listProxies.length;
  }

  getStatistics() {
    return Object.entries(this.statistics).reduce((results, [key, value]) => {
      value.total_requests =
        value.blocked_requests + value.fail_requests + value.success_requests;
      results[key] = value;
      return results;
    }, {});
  }
}
