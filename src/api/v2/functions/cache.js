import { mc } from "./memcached";
const { promisify } = require("util");

// const getData = async (key) => {
//   try {
//     const getDataPromise = promisify(mc.get);
//     const data = await getDataPromise(key, (err, val) => {
//       return val;
//     });
//     console.log("found");
//     return data;
//     return JSON.parse(data);
//   } catch (err) {
//     console.log(err);
//     console.log("not found");
//     return false;
//   }
// };
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
