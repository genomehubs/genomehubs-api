import { checkDocResponse } from "../functions/checkDocResponse";
import { client } from "../functions/connection";
import { formatJson } from "../functions/formatJson";
import { formatCsv } from "../functions/formatCsv";
import { getRecordsById } from "../functions/getRecordsById";
import { getRecordsByTaxon } from "../functions/getRecordsByTaxon";
import { attrTypes } from "../functions/attrTypes";
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

const parseFields = async (fields) => {
  if (!fields || fields == "all") {
    let typesMap = await attrTypes();
    fields = Object.keys(typesMap);
  } else {
    fields = fields.split(/\s*,\s*/);
  }
  return fields;
};

const generateQuery = async ({
  query,
  result,
  fields,
  includeEstimates,
  includeRawValues,
  searchRawValues,
  summaryValues,
  excludeAncestral,
  excludeDescendant,
  excludeDirect,
  size = 10,
  offset = 0,
  sortBy,
  sortOrder,
  sortMode,
}) => {
  let typesMap = await attrTypes();
  fields = await parseFields(fields);
  let exclusions = {};
  if (excludeAncestral) {
    exclusions.ancestor = excludeAncestral;
  }
  if (excludeDescendant) {
    exclusions.descendant = excludeDescendant;
  }
  if (excludeDirect) {
    exclusions.direct = excludeDirect;
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
          exclusions,
          rank,
          summaryValues,
          size,
          offset,
          sortBy,
        },
      };
    } else if (taxTerm[1] == "name") {
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
          exclusions,
          rank,
          summaryValues,
          size,
          offset,
          sortBy,
        },
      };
    } else if (taxTerm[1] == "tree") {
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
          exclusions,
          summaryValues,
          size,
          offset,
          sortBy,
        },
      };
    }
  } else {
    return {
      func: getRecordsByTaxon,
      params: {
        searchTerm: false,
        result,
        ancestral: true,
        fields,
        includeEstimates,
        includeRawValues,
        searchRawValues,
        rank,
        depth,
        filters,
        exclusions,
        summaryValues,
        size,
        offset,
        sortBy,
      },
    };
  }
};

export const getResults = async (params) => {
  let query = await generateQuery({ ...params });
  let index = indexName({ ...params });
  return query.func({ index, ...query.params });
};

module.exports = {
  getSearchResults: async (req, res) => {
    let response = {};
    response = await getResults(req.query);
    return res.format({
      json: () => {
        if (req.query.filename) {
          let filename = `${req.query.filename.replace(/\.json$/, "")}.json`;
          res.attachment(filename);
        }
        res.status(200).send(formatJson(response, req.query.indent));
      },
      csv: async () => {
        let opts = {
          delimiter: ",",
          fields: await parseFields(req.query.fields),
          tidyData: req.query.tidyData,
          includeRawValues: req.query.includeRawValues,
        };
        let csv = await formatCsv(response, opts);
        if (req.query.filename) {
          let filename = `${req.query.filename.replace(/\.csv$/, "")}.csv`;
          res.attachment(filename);
        }
        res.status(200).send(csv);
      },

      tsv: async () => {
        let opts = {
          delimiter: "\t",
          fields: await parseFields(req.query.fields),
          tidyData: req.query.tidyData,
          includeRawValues: req.query.includeRawValues,
        };
        let tsv = await formatCsv(response, opts);
        if (req.query.filename) {
          let filename = `${req.query.filename.replace(/\.tsv$/, "")}.tsv`;
          res.attachment(filename);
        }
        res.status(200).send(tsv);
      },
    });
  },
};
