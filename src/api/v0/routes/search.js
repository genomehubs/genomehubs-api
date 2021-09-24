import { attrTypes } from "../functions/attrTypes";
import { formatCsv } from "../functions/formatCsv";
import { formatJson } from "../functions/formatJson";
import { getRecordsByTaxon } from "../functions/getRecordsByTaxon";
import { indexName } from "../functions/indexName";
import { lookupAlternateIds } from "../functions/lookupAlternateIds";

const operations = (str) => {
  const translate = {
    ">": ["gt"],
    ">=": ["gte"],
    "<": ["lt"],
    "<=": ["lte"],
    "=": ["gte", "lte"],
  };
  let operator = translate[str];
  return operator || [];
};

const parseFields = async ({ result, fields }) => {
  try {
    if (!fields) {
      let typesMap = await attrTypes({ result });
      fields = Object.keys(typesMap).filter(
        (key) => typesMap[key].display_level == 1
      );
    } else if (fields == "all") {
      let typesMap = await attrTypes({ result });
      fields = Object.keys(typesMap);
    } else {
      fields = fields.split(/\s*,\s*/);
    }
    return fields;
  } catch (error) {
    return [];
  }
};

export const setExclusions = ({
  excludeAncestral,
  excludeDescendant,
  excludeDirect,
  excludeMissing,
}) => {
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
  if (excludeMissing) {
    exclusions.missing = excludeMissing;
  }
  return exclusions;
};

const setSortBy = ({ sortBy, sortOrder, sortMode }) => {
  if (sortBy) {
    let sort = {};
    sort.by = sortBy;
    if (sortOrder) {
      sort.order = sortOrder;
    }
    if (sortMode) {
      sort.mode = sortMode;
    }
    sortBy = sort;
  }
  return sortBy;
};

const addCondition = (conditions, parts) => {
  if (!conditions) {
    conditions = {};
  }
  let segments = parts[0].split(/[\(\)]/);
  let stat;
  if (segments.length > 1) {
    stat = segments[0];
    parts[0] = segments[1];
  }
  if (!conditions[parts[0]]) {
    conditions[parts[0]] = {};
  }
  if (stat) {
    conditions[parts[0]]["stat"] = stat;
  }
  if (parts[1] == "==") {
    conditions[parts[0]] = parts[2];
  } else {
    operations(parts[1]).forEach((operator) => {
      conditions[parts[0]][operator] = parts[2];
    });
  }
  return conditions;
};

const generateQuery = async ({
  query,
  result,
  fields,
  names,
  ranks,
  includeEstimates,
  includeRawValues,
  searchRawValues,
  summaryValues,
  exclusions,
  size = 10,
  offset = 0,
  sortBy,
  aggs,
}) => {
  let typesMap = await attrTypes({ ...query });
  fields = await parseFields({ result, fields });
  if (ranks) {
    let rankNames = ranks.split(/\s*,\s*/);
    ranks = {};
    rankNames.forEach((name) => {
      ranks[name] = true;
    });
  }
  if (names) {
    let nameClasses = names.split(/\s*,\s*/);
    names = {};
    nameClasses.forEach((nameClass) => {
      names[nameClass] = true;
    });
  }
  let taxTerm, rank, depth, multiTerm, idTerm;
  let filters = {};
  let properties = {};
  if (query && query.match(/\n/)) {
    multiTerm = query.split(/\n/).filter((v) => v > "");
  } else if (query) {
    query.split(/\s+(?:AND|and)\s+/).forEach((term) => {
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
        if (typesMap[result][term]) {
          let bins = typesMap[result][term].bins;
          if (bins && bins.scale && bins.scale.startsWith("log")) {
            term += " > 0";
          }
        }
        if (term.match(/[\>\<=]/)) {
          let parts = term.split(/\s*([\>\<=]+)\s*/);
          if (typesMap[result]) {
            filters = addCondition(filters, parts);
          } else {
            properties = addCondition(properties, parts);
          }
        } else {
          if (typesMap[result][term]) {
            fields.push(term);
          } else {
            idTerm = term;
          }
        }
      }
    });
  }

  let params = {
    idTerm,
    result,
    fields,
    names,
    ranks,
    depth,
    ancestral: false,
    includeEstimates,
    includeRawValues,
    searchRawValues,
    filters,
    properties,
    exclusions,
    rank,
    summaryValues,
    size,
    offset,
    sortBy,
    aggs,
  };
  if (taxTerm) {
    if (taxTerm[1] == "eq") {
      return {
        func: getRecordsByTaxon,
        params: {
          ...params,
          searchTerm: taxTerm[2],
          includeEstimates: true,
        },
      };
    } else if (taxTerm[1] == "name") {
      return {
        func: getRecordsByTaxon,
        params: {
          ...params,
          searchTerm: taxTerm[2],
          includeEstimates: true,
        },
      };
    } else if (taxTerm[1] == "tree") {
      return {
        func: getRecordsByTaxon,
        params: {
          ...params,
          searchTerm: taxTerm[2],
          ancestral: true,
        },
      };
    }
  } else if (multiTerm) {
    return {
      func: getRecordsByTaxon,
      params: {
        ...params,
        multiTerm,
      },
    };
  } else {
    return {
      func: getRecordsByTaxon,
      params: {
        ...params,
        searchTerm: false,
        ancestral: true,
      },
    };
  }
};

export const getResults = async (params) => {
  let query = await generateQuery({ ...params });
  let index = indexName({ ...params });
  return query.func({ index, ...query.params });
};

const replaceSearchIds = async (params) => {
  let query = params.query;
  let index = indexName({ ...params });
  let match = query.match(/tax_\w+\(([^\)]+)/);
  if (match) {
    let ids = match.slice(1);
    if (ids.length > 0) {
      let altIds = await lookupAlternateIds({ recordId: ids, index });
      if (altIds.length == ids.length) {
        for (let i = 0; i < altIds.length; i++) {
          let altId = altIds[i].replace("taxon_id-", "");
          query = query.replace(`(${ids[i]})`, `(${altId})`);
        }
      }
    }
  }

  return query;
};

module.exports = {
  getSearchResults: async (req, res) => {
    let response = {};
    let exclusions = setExclusions(req.query);
    let sortBy = setSortBy(req.query);
    response = await getResults({ ...req.query, exclusions, sortBy });
    if (response.status.hits == 0) {
      let query = await replaceSearchIds(req.query);
      if (query != req.query.query) {
        response = await getResults({
          ...req.query,
          query,
          exclusions,
          sortBy,
        });
        response.queryString = query;
      }
    }
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
          fields: await parseFields({ ...req.query }),
          names: req.query.names ? req.query.names.split(/\s*,\s*/) : [],
          ranks: req.query.ranks ? req.query.ranks.split(/\s*,\s*/) : [],
          tidyData: req.query.tidyData,
          includeRawValues: req.query.includeRawValues,
          result: req.query.result,
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
          fields: await parseFields({ ...req.query }),
          names: req.query.names ? req.query.names.split(/\s*,\s*/) : [],
          ranks: req.query.ranks ? req.query.ranks.split(/\s*,\s*/) : [],
          tidyData: req.query.tidyData,
          includeRawValues: req.query.includeRawValues,
          result: req.query.result,
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
