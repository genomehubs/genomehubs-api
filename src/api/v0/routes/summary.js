import { checkDocResponse } from "../functions/checkDocResponse";
import { client } from "../functions/connection";
import { formatJson } from "../functions/formatJson";

const getSummary = async (params) => {
  console.log("summary");
  console.log(params);
  return {};
  // const { body } = await client
  //   .mget({
  //     index: `${params.result}--ncbi--demo--v0.1`,
  //     body: { ids },
  //   })
  //   .catch((err) => {
  //     return err.meta;
  //   });
  // let status = checkDocResponse({ body });
  // let records = [];
  // if (status.hits) {
  //   body.docs.forEach((doc) => {
  //     let obj = { id: doc._id, index: doc._index, found: doc.found };
  //     if (doc.found && doc._source) {
  //       obj.record = processDoc({ doc: doc._source });
  //     }
  //     records.push(obj);
  //   });
  // }
  // return { status, records };
};

module.exports = {
  getSearchSummary: async (req, res) => {
    let response = {};
    response = await getSummary(req.query);
    return res.status(200).send(formatJson(response, req.query.indent));
  },
};
