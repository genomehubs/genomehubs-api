const Memcached = require("memcached-promise");

import { config } from "./config";

export const mc = config.memcached
  ? new Memcached("localhost:12345", {
      maxExpiration: 2592000,
      namespace: `${config.hub}${config.separator}${config.release}`,
      debug: false,
    })
  : undefined;
