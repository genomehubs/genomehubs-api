import { checkResponse } from "./checkResponse";
import { client } from "./connection";
import { indexName } from "./indexName";
import { config } from "../functions/config.js";

const fetchTypes = async ({ result, taxonomy, hub, release }) => {
  let index = indexName({ result: "attributes", hub, release });
  const { body } = await client
    .search({
      index,
      body: {
        query: {
          match: {
            group: {
              query: result,
            },
          },
        },
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
      types[hit._source.name] = hit._source;
    });
  }
  return types;
};

export const attrTypes = async () =>
  await fetchTypes({
    result: "taxon",
    taxonomy: config.taxonomy,
    hub: config.hub,
    release: config.release,
  });
