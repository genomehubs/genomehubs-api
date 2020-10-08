import { checkDocResponse } from "../functions/checkDocResponse";
import { client } from "../functions/connection";
import { formatJson } from "../functions/formatJson";
import { getResults } from "./search";

const getResultCount = async (params) => {
  params.size = 0;
  let result = await getResults(params);
  let response = { status: {}, count: 0 };
  ["success", "error"].forEach((key) => {
    if (result.status.hasOwnProperty(key)) {
      response.status[key] = result.status[key];
    }
  });
  if (result.status.hasOwnProperty("hits")) {
    response.count = result.status.hits;
  }
  return response;
};

module.exports = {
  getSearchResultCount: async (req, res) => {
    let response = {};
    response = await getResultCount(req.query);
    return res.status(200).send(formatJson(response, req.query.indent));
  },
};
