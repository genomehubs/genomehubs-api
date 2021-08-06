import { checkDocResponse } from "./checkDocResponse";
import { checkResponse } from "./checkResponse";
import { client } from "./connection";
import { indexName } from "./indexName";
import { processDoc } from "./processDoc";
import { processHits } from "./processHits";

const convertIdsToDocIds = (recordId, result) => {
  /**
   * Converts a set of entry IDs into document IDs
   * @param {string|Array} recordId - One or more record IDs.
   * @param {string} result - The index type.
   */
  let ids = Array.isArray(recordId) ? recordId : [recordId];
  if (result == "taxon") {
    ids = ids.map((id) => (id.match(/^taxon_id-/) ? id : `taxon_id-${id}`));
  } else if (result == "assembly") {
    ids = ids.map((id) => (id.match(/^assembly-/) ? id : `assembly-${id}`));
  } else if (result == "analysis") {
    ids = ids.map((id) => (id.match(/^analysis-/) ? id : `analysis-${id}`));
  } else if (result == "file") {
    ids = ids.map((id) => (id.match(/^file-/) ? id : `file-${id}`));
  }
  return ids;
};

const altRecordId = async ({ index, name, source }) => {
  const { body } = await client
    .searchTemplate({
      index,
      body: { id: "taxon_by_specific_name", params: { name, source } },
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      return err.meta;
    });
  let results = [];
  let status = checkResponse({ body });
  if (status.hits && status.hits > 0) {
    results = processHits({ body, reason: true });
  }
  results = results.map((result) => result.id);
  return results;
};

const lookupAlternateIds = async ({ recordId, index }) => {
  let newIds = [];
  for (const id of recordId) {
    let match = String(id).match(/^(\D+)[_:]*(\d+)/);
    let source = "ncbi";
    let name = String(id);
    if (match) {
      source = match[1];
      name = match[2];
    }
    let alternateIds = await altRecordId({ index, name, source });
    newIds = newIds.concat(alternateIds);
  }
  return newIds;
};

export const getRecordsById = async ({
  recordId,
  result,
  taxonomy,
  hub,
  release,
  iteration = 0,
}) => {
  /**
   * Get specified records from an index by entry or document ID.
   * @param {Object} recordInfo Information about the record.
   * @param {string|Array} recordInfo.recordId - One or more record IDs.
   * @param {string} recordInfo.result - The index type.
   * @param {string} recordInfo.taxonomy - Backbone taxonomy name.
   * @param {string} recordInfo.hub - Hub name.
   * @param {string} recordInfo.release - Hub release version.
   */
  let index = indexName({ result, taxonomy, hub, release });
  let ids = convertIdsToDocIds(recordId, result);
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
        obj.record.record_id = obj.record[`${result}_id`];
        records.push(obj);
      }
    });
  }
  iteration++;
  if (records.length == 0 && iteration == 1) {
    let newIds = await lookupAlternateIds({ recordId, index });
    if (newIds.length > 0) {
      let alt = await getRecordsById({
        recordId: newIds,
        result,
        taxonomy,
        hub,
        release,
        iteration: 2,
      });
      status = alt.status;
      records = alt.records;
    }
  }
  return { status, records };
};
