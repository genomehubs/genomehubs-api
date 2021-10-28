import { checkResponse } from "./checkResponse";
import { client } from "./connection";
import { processHits } from "./processHits";
import { searchByTaxon } from "../queries/searchByTaxon";

export const getRecordsByTaxon = async (props) => {
  let searchBy = searchByTaxon;
  const query = await searchBy(props);
  const { body } = await client
    .search({
      index: props.index,
      body: query,
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      console.log(err.meta.body.error);
      return err.meta;
    });
  let results = [];
  let aggs;
  let status = checkResponse({ body });
  status.size = props.size;
  status.offset = props.offset;
  if (status.hits) {
    results = processHits({
      body,
      inner_hits: true,
      lca: props.lca,
      names: props.names,
      ranks: props.ranks,
    });
    if (body.aggregations) {
      aggs = body.aggregations;
    }
  }
  return { status, results, aggs, query, fields: props.fields };
};
