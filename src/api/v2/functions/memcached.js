const memjs = require("memjs");

import { config } from "./config";

export const mc = config.memcached
  ? memjs.Client.create(config.memcached)
  : undefined;
