import { aggregateRawValueSources } from "../queries/aggregateRawValueSources";
import { attrTypes } from "../functions/attrTypes";
import { checkResponse } from "../functions/checkResponse";
import { client } from "../functions/connection";
import { formatJson } from "../functions/formatJson";
import { getResultCount } from "./count";
import { indexName } from "../functions/indexName";
import qs from "qs";

const setRanks = (rank) => {
  if (rank) {
    return rank.split(/[,;\s]+/);
  } else {
    return [
      "superkingdom",
      "kingdom",
      "phylum",
      "class",
      "order",
      "family",
      "genus",
      "species",
      "subspecies",
    ];
  }
};
const queryParams = ({ term, result, rank, includeEstimates = false }) => {
  let params = {
    result,
    query: term,
    includeEstimates,
  };
  let fields = [];
  if (rank) {
    if (params.query) {
      params.query += ` AND tax_rank(${rank})`;
      let field = term.replace(/[^\w_].+$/, "");
      params.includeEstimates = true;
      params.excludeAncestral = [field];
      params.excludeMissing = [field];
      fields.push(field);
    } else {
      params.includeEstimates = true;
      params.query = `tax_rank(${rank})`;
    }
  }
  return { params, fields };
};

export const xInY = async ({ x, y, result, rank, queryString }) => {
  let { params, fields } = queryParams({ term: y, result, rank });
  let yCount = await getResultCount({ ...params });
  let yQuery = { ...params };
  if (fields.length > 0) {
    yQuery.fields = fields.join(",");
  }
  params.query += ` AND ${x}`;
  if (rank) {
    let field = x.replace(/[^\w_].+$/, "");
    params.includeEstimates = true;
    params.excludeAncestral = [
      ...(yQuery.excludeAncestral ? yQuery.excludeAncestral : []),
      field,
    ];
    params.excludeMissing = [
      ...(yQuery.excludeMissing ? yQuery.excludeMissing : []),
      field,
    ];
    fields.push(field);
  }
  let xCount = await getResultCount({ ...params });
  let xQuery = params;
  if (fields.length > 0) {
    xQuery.fields = fields.join(",");
  }
  if (
    xCount.status &&
    xCount.status.success &&
    yCount.status &&
    yCount.status.success
  ) {
    return {
      status: { success: true },
      report: {
        xiny: xCount.count > 0 ? xCount.count / yCount.count : 0,
        x: xCount.count,
        y: yCount.count,
        xTerm: x,
        yTerm: y,
        ...(rank && { rank }),
        xQuery,
        yQuery,
        queryString,
      },
    };
  }
};

export const xInYPerRank = async ({ x, y, result, rank, queryString }) => {
  // Return xInY at a list of ranks
  let ranks = setRanks(rank);
  let perRank = [];
  for (rank of ranks) {
    let res = await xInY({ x, y, result, rank });
    perRank.push(res.report);
  }
  let report = perRank.length == 1 ? perRank[0] : perRank;
  let caption = `Taxa`;
  if (x) {
    caption += ` with ${x} out of all taxa`;
  }
  if (y) {
    caption += ` with ${y}`;
  }
  return {
    status: { success: true },
    report: {
      xInY: report,
      queryString,
      caption,
    },
  };
};

export const xPerRank = async ({ x, result = "taxon", rank, queryString }) => {
  // Return counts at a list of ranks
  let ranks = setRanks(rank);
  let perRank = [];
  let includeEstimates = x ? false : true;
  for (rank of ranks) {
    let { params, fields } = queryParams({
      term: x,
      result,
      rank,
      includeEstimates,
    });
    let xCount = await getResultCount({ ...params });
    let xQuery = params;
    if (fields.length > 0) {
      xQuery.fields = fields.join(",");
    }
    perRank.push({
      x: xCount.count,
      xTerm: x,
      rank,
      xQuery,
      ...(fields.length > 0 && { fields: fields.join(",") }),
    });
  }
  let caption = `Count${ranks.length > 1 ? "s" : ""} of taxa`;
  if (x) {
    caption += ` with ${x}`;
  }

  return {
    status: { success: true },
    report: {
      xPerRank: perRank,
      queryString,
      caption,
    },
  };
};

export const getRawSources = async (params) => {
  let index = indexName({ ...params });
  const query = await aggregateRawValueSources({});
  const { body } = await client
    .search({
      index,
      body: query,
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      return err.meta;
    });
  let sources = [];
  let status = checkResponse({ body });
  if (status.hits) {
    sources = body.aggregations.attributes.summary.terms;
  }
  return { status, sources };
};

export const getSources = async (params) => {
  const types = await attrTypes({
    result: params.result,
    indexType: "attributes",
  });
  const binned = await getRawSources(params);
  let counts = {};
  if (binned.status.success) {
    binned.sources.buckets.forEach((obj) => {
      counts[obj.key] = obj.doc_count;
    });
  }
  let sources = {};
  Object.values(types).forEach((meta) => {
    let source = meta.source || [];
    let source_url = meta.source_url || [];
    let source_url_stub = meta.source_url_stub || [];
    let value = meta.key || meta.name;
    if (!Array.isArray(source)) {
      source = [source];
    }
    if (!Array.isArray(source_url)) {
      source_url = [source_url];
    }
    if (!Array.isArray(source_url_stub)) {
      source_url_stub = [source_url_stub];
    }
    source.forEach((src, i) => {
      if (!sources.hasOwnProperty(src)) {
        sources[src] = {
          url: source_url[i] || source_url_stub[i],
          attributes: [],
        };
        let lcSrc = src.toLowerCase();
        if (counts[lcSrc]) {
          sources[src].count = counts[lcSrc];
        }
      }
      sources[src].attributes.push(value);
    });
  });
  return sources;
};

module.exports = {
  getReport: async (req, res) => {
    let report = {};
    let queryString = qs.stringify(req.query);
    switch (req.query.report) {
      case "sources": {
        report = await getSources({ ...req.query, queryString });
        break;
      }
      case "xInY": {
        report = await xInYPerRank({ ...req.query, queryString });
        break;
      }
      case "xPerRank": {
        report = await xPerRank({ ...req.query, queryString });
        break;
      }
    }
    if (report && report != {}) {
      return res
        .status(200)
        .send(
          formatJson({ status: { success: true }, report }, req.query.indent)
        );
    }
    return res.status(404).send({ status: "error" });
  },
};
