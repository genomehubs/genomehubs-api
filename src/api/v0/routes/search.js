import { checkDocResponse } from "../functions/checkDocResponse";
import { client } from "../functions/connection";
import { formatJson } from "../functions/formatJson";
import { getRecordsById } from "../functions/getRecordsById";
import { getRecordsByTaxon } from "../functions/getRecordsByTaxon";
import { typesMap } from "../functions/typesMap";
import { indexName } from "../functions/indexName";

const generateQuery = ({
  query,
  result,
  fields,
  includeEstimates,
  rawValues,
}) => {
  if (fields == "all") {
    fields = Object.keys(typesMap);
  } else {
    fields = fields.split(",");
  }
  let taxTerm = query.match(/tax_([^r]\w+)\((.+?)\)/);
  let taxRank = query.match(/tax_rank\((.+?)\)/);
  let rank;
  if (taxRank) {
    rank = taxRank[1];
  }
  if (taxTerm) {
    if (taxTerm[1] == "eq") {
      return {
        func: getRecordsById,
        params: {
          recordId: taxTerm[2],
          result,
          fields,
          includeEstimates,
          rawValues,
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
          includeEstimates,
          rawValues,
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
          rawValues,
          rank,
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
