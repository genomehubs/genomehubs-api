import { getResults, setExclusions } from "../routes/search";
import { scaleLinear, scaleLog, scaleSqrt } from "d3-scale";

import { attrTypes } from "../functions/attrTypes";
import { checkResponse } from "../functions/checkResponse";
import { client } from "../functions/connection";
import { format } from "d3-format";
import { formatJson } from "../functions/formatJson";
import { indexName } from "../functions/indexName";
import { queryParams } from "./queryParams";
import { setAggs } from "./setAggs";

const valueTypes = {
  long: "integer",
  integer: "integer",
  short: "integer",
  byte: "integer",
  date: "date",
  keyword: "keyword",
};

const getTree = async ({ params, fields, summaries, result, exclusions }) => {
  let typesMap = await attrTypes({ result });
  params.size = 10;
  // find max and min plus most frequent categories
  let field = fields[0];
  let summary = summaries[0];
  let valueType = valueTypes[typesMap[field].type] || "float";
  params.aggs = await setAggs({
    field,
    summary,
    result,
    tree: true,
  });
  let res = await getResults({ ...params, fields, exclusions });
  let hist = res.aggs.aggregations[field].histogram;
  if (!hist) {
    return res;
  }
  return hist;
};

export const tree = async ({ x, cat, result, apiParams }) => {
  let { params, fields, summaries } = queryParams({ term: x, result });
  let xQuery = { ...params };
  let typesMap = await attrTypes({ result });
  let exclusions;
  if (apiParams.includeEstimates) {
    delete params.excludeAncestral;
    delete xQuery.excludeAncestral;
  } else {
    if (cat && typesMap[cat]) {
      params.excludeAncestral.push(cat);
    }
  }
  if (cat && typesMap[cat]) {
    params.excludeMissing.push(cat);
  }
  exclusions = setExclusions(params);
  let tree = await getTree({
    params,
    fields,
    summaries,
    result,
    exclusions,
  });
  // "aggs": {
  //   "aggregations": {
  //     "doc_count": 5708,
  //     "c_value": {
  //       "doc_count": 697,
  //       "stats": {
  //         "count": 697,
  //         "min": 1.009765625,
  //         "max": 2.16015625,
  //         "avg": 1.362065100430416,
  //         "sum": 949.359375
  //       }
  //     }
  //   }
  // },

  return {
    status: { success: true },
    report: {
      tree,
      xQuery: {
        ...xQuery,
        fields: fields.join(","),
      },
      x: 0,
    },
    xQuery,
    xLabel: fields[0],
  };
};
