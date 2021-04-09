import { aggregateRawValueSources } from "../queries/aggregateRawValueSources";
import { attrTypes } from "../functions/attrTypes";
import { checkResponse } from "../functions/checkResponse";
import { client } from "../functions/connection";
import { formatJson } from "../functions/formatJson";
import { getResultCount } from "./count";
import { indexName } from "../functions/indexName";

export const xInY = async ({ x, y, result, rank }) => {
  let params = {
    result,
    query: y,
    includeEstimates: false,
  };
  if (rank) {
    params.query += ` AND tax_rank(${rank})`;
    let field = y.replace(/[^\w_].+$/, "");
    params.includeEstimates = true;
    params.excludeAncestral = [field];
    params.excludeMissing = [field];
  }
  let yCount = await getResultCount({ ...params });
  let yQuery = { ...params };
  params.query += ` AND ${x}`;
  if (rank) {
    let field = x.replace(/[^\w_].+$/, "");
    params.includeEstimates = true;
    params.excludeAncestral = [...yQuery.excludeAncestral, field];
    params.excludeMissing = [...yQuery.excludeMissing, field];
  }
  let xCount = await getResultCount({ ...params });
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
        xQuery: params,
        yQuery,
      },
    };
  }
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
    let response = {};
    switch (req.query.report) {
      case "xiny": {
        response = await xInY({ ...req.query });
      }
      case "sources": {
        response = await getSources({ ...req.query });
      }
    }
    if (response && response != {}) {
      return res.status(200).send(formatJson(response, req.query.indent));
    }
    return res.status(404).send({ status: "error" });
  },
};
