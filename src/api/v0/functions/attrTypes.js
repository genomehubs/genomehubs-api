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

// export const typesMap = {
//   assembly_span: {
//     bins: {
//       min: 6,
//       max: 11,
//       count: 10,
//       scale: "log10",
//     },
//     type: "long",
//     summary: ["count", "max", "min"],
//   },
//   c_value: {
//     bins: {
//       min: -2.5,
//       max: 2.5,
//       count: 10,
//       scale: "log10",
//     },
//     type: "half_float",
//     summary: ["count", "max", "min"],
//   },
//   c_value_method: {
//     type: "keyword",
//     summary: ["list"],
//   },
//   cell_type: {
//     type: "keyword",
//     summary: ["list"],
//   },
//   genome_size: {
//     bins: {
//       min: 6,
//       max: 11,
//       count: 10,
//       scale: "log10",
//     },
//     type: "long",
//     summary: ["count", "max", "min"],
//   },
//   sample_location: { type: "geo_point", fields: ["count"] },
//   sample_sex: { type: "keyword", fields: ["count"] },
// };
