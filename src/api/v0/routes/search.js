import { checkDocResponse } from "../functions/checkDocResponse";
import { client } from "../functions/connection";
import { formatJson } from "../functions/formatJson";
import { getRecordsById } from "../functions/getRecordsById";
import { getRecordsByTaxon } from "../functions/getRecordsByTaxon";
import { typesMap } from "../functions/typesMap";
import { indexName } from "../functions/indexName";

const operations = (str) => {
  const translate = {
    ">": ["gt"],
    ">=": ["gte"],
    "<": ["lt"],
    "<=": ["lte"],
    "=": ["gte", "lte"],
    "==": ["gte", "lte"],
  };
  let operator = translate[str];
  return operator;
};

const generateQuery = ({
  query,
  result,
  fields,
  includeEstimates,
  includeRawValues,
  searchRawValues,
  summaryValues,
  sortBy,
  sortOrder,
  sortMode,
}) => {
  if (!fields || fields == "all") {
    fields = Object.keys(typesMap);
  } else {
    fields = fields.split(/\s*,\s*/);
  }
  let taxTerm, rank, depth;
  let filters = {};
  query.split(/\s*AND\s*/).forEach((term) => {
    let taxQuery = term.match(/tax_(\w+)\((.+?)\)/);
    if (taxQuery) {
      if (taxQuery[1] == "rank") {
        rank = taxQuery[2];
      } else if (taxQuery[1] == "depth") {
        depth = taxQuery[2];
      } else {
        taxTerm = taxQuery;
      }
    } else {
      let parts = term.split(/\s*([\>\<=]+)\s*/);
      if (typesMap[parts[0]]) {
        if (!filters[parts[0]]) {
          filters[parts[0]] = {};
        }
        operations(parts[1]).forEach((operator) => {
          filters[parts[0]][operator] = parts[2];
        });
      }
    }
  });
  let sort;
  if (sortBy) {
    sort = {};
    sort.by = sortBy;
    if (sortOrder) {
      sort.order = sortOrder;
    }
    if (sortMode) {
      sort.mode = sortMode;
    }
    sortBy = sort;
  }
  if (taxTerm) {
    if (taxTerm[1] == "eq") {
      return {
        func: getRecordsByTaxon,
        params: {
          searchTerm: taxTerm[2],
          result,
          fields,
          ancestral: false,
          includeEstimates: true,
          includeRawValues,
          searchRawValues,
          filters,
          rank,
          summaryValues,
          sortBy,
        },
      };
    }
    if (taxTerm[1] == "name") {
      return {
        func: getRecordsByTaxon,
        params: {
          searchTerm: taxTerm[2],
          result,
          fields,
          ancestral: false,
          includeEstimates: true,
          includeRawValues,
          searchRawValues,
          filters,
          rank,
          summaryValues,
          sortBy,
        },
      };
    }
    if (taxTerm[1] == "tree") {
      return {
        func: getRecordsByTaxon,
        params: {
          searchTerm: taxTerm[2],
          result,
          ancestral: true,
          fields,
          includeEstimates,
          includeRawValues,
          searchRawValues,
          rank,
          depth,
          filters,
          summaryValues,
          sortBy,
        },
      };
    }
  }
};

const getResults = async (params) => {
  let query = generateQuery({ ...params });
  let index = indexName({ ...params });
  return query.func({ index, ...query.params });
};

module.exports = {
  getSearchResults: async (req, res) => {
    let response = {};
    response = await getResults(req.query);
    return res.status(200).send(formatJson(response, req.query.indent));
  },
};
