import { checkResponse } from "./checkResponse";
import { client } from "./connection";
import { indexName } from "./indexName";
import { config } from "../functions/config.js";

const fetchTypes = async ({ result, taxonomy, hub, release }) => {
  let index = indexName({ result: "attributes", hub, release });
  let query = {
    match: {
      group: {
        query: result,
      },
    },
  };
  if (result == "multi") {
    query = {
      match_all: {},
    };
  }
  const { body } = await client
    .search({
      index,
      body: {
        query,
        size: 1000,
      },
    })
    .catch((err) => {
      return err.meta;
    });
  let status = checkResponse({ body });
  let types = {};
  if (status.hits) {
    body.hits.hits.forEach((hit) => {
      if (!types[hit._source.group]) {
        types[hit._source.group] = {};
      }
      types[hit._source.group][hit._source.name] = hit._source;
    });
  }
  if (result != "multi") {
    return types[result];
  }
  return types;
};

export const attrTypes = async ({ result = "multi" }) =>
  await fetchTypes({
    result,
    taxonomy: config.taxonomy,
    hub: config.hub,
    release: config.release,
  });
