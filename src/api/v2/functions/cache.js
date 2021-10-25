import { mc } from "./memcached";

export const cacheFetch = async (req) => {
  if (mc) {
    const key = req.url;
    try {
      let cachedData = await mc.get(key);
      return JSON.parse(cachedData);
    } catch {
      return false;
    }
  } else {
    return false;
  }
};

export const cacheStore = async (req, obj) => {
  if (mc) {
    const key = req.url;
    mc.set(key, JSON.stringify(obj));
  }
};
