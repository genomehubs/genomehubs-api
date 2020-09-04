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
      }),
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      console.log(err.meta.body.error);
      return err.meta;
    });
  let records = [];
  let status = checkResponse({ body });
  if (status.hits) {
    records = processHits({ body, inner_hits: true });
  }
  return { status, records };
};
