import { checkDocResponse } from "./checkDocResponse";
import { client } from "./connection";
import { indexName } from "./indexName";
import { processDoc } from "./processDoc";

export const getRecordsById = async ({
  recordId,
  result,
  taxonomy,
  hub,
  version,
}) => {
  let index = indexName({ result, taxonomy, hub, version });
  let ids = Array.isArray(recordId) ? recordId : [recordId];
  if (result == "taxon") {
    ids = ids.map((id) => (id.match(/^taxon_id-/) ? id : `taxon_id-${id}`));
  }
  const { body } = await client
    .mget({
      index,
      body: { ids },
    })
    .catch((err) => {
      return err.meta;
    });
  let status = checkDocResponse({ body });
  let records = [];
  if (status.hits) {
    body.docs.forEach((doc) => {
      let obj = { id: doc._id, index: doc._index, found: doc.found };
      if (doc.found && doc._source) {
        obj.record = processDoc({ doc: doc._source });
      }
      records.push(obj);
    });
  }
  return { status, records };
};
