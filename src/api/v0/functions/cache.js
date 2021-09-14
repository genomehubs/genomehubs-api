import { mc } from "./memcached";

export const cache = (req, res, next) => {
  const pathname = req._parsedOriginalUrl.pathname;
  if (mc && pathname && pathname.endsWith("/report")) {
    const key = req.url;
    mc.get(key, (err, val) => {
      if (err == null && val != null) {
        res.send(JSON.parse(val));
      } else {
        res.sendResponse = res.send;
        res.send = (body) => {
          res.sendResponse(body);
          mc.set(key, JSON.stringify(body), { expires: 0 }, (err, reply) => {
            if (reply == true) {
              res.sendResponse(body);
            }
          });
        };
      }
      next();
    });
  } else {
    next();
  }
};
