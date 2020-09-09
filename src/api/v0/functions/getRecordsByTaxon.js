import { checkResponse } from "./checkResponse";
import { client } from "./connection";
import { processHits } from "./processHits";
import { searchByTaxon } from "../queries/searchByTaxon";

export const getRecordsByTaxon = async ({
  index,
  searchTerm,
  result,
  ancestral,
  fields,
  includeEstimates,
  rawValues,
  rank,
  depth,
  filters,
  summaryValues,
  sortBy,
}) => {
  const { body } = await client
    .search({
      index,
      body: searchByTaxon({
        searchTerm,
        ancestral,
        fields,
        includeEstimates,
        rawValues,
        rank,
        depth,
        filters,
        summaryValues,
        sortBy,
      }),
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      console.log(err.meta.body.error);
      return err.meta;
    });
  let results = [];
  let status = checkResponse({ body });
  if (status.hits) {
    results = processHits({ body, inner_hits: true });
  }
  return { status, results };
};
