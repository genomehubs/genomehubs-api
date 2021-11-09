import { cacheFetch, cacheStore } from "../functions/cache";

import { aggregateRawValueSources } from "../queries/aggregateRawValueSources";
import { attrTypes } from "../functions/attrTypes";
import { checkResponse } from "../functions/checkResponse";
import { client } from "../functions/connection";
import { combineQueries } from "../functions/combineQueries";
import { formatJson } from "../functions/formatJson";
import { getResultCount } from "./count";
import { histogram } from "../reports/histogram";
import { indexName } from "../functions/indexName";
import qs from "qs";
import { queryParams } from "../reports/queryParams";
import { setRanks } from "../functions/setRanks";
import { tree } from "../reports/tree";

const plurals = (singular) => {
  const ranks = {
    genus: "genera",
    family: "families",
    order: "orders",
    class: "classes",
    phylum: "phyla",
    kingdom: "kingdoms",
    superkingdom: "superkingdoms",
  };
  return ranks[singular.toLowerCase()] || singular;
};

export const getTree = async ({
  x,
  y,
  cat,
  taxonomy,
  queryString,
  ...apiParams
}) => {
  // Return tree of results
  let status;
  let res = await tree({
    x,
    y,
    result: apiParams.result,
    taxonomy,
    apiParams,
  });
  if (res.status.success == false) {
    if (!status) {
      status = res.status;
    }
  } else {
    status = { success: true };
  }
  let report = res.report;
  let xQuery = res.xQuery;
  let yQuery = res.yQuery;
  let xLabel = res.xLabel;
  let caption;
  if (report) {
    caption = `Tree of ${x}${report.y ? ` highlighting ${y}` : ""}`;
    if (cat) {
      caption += ` by ${cat}`;
    }
    if (apiParams.includeEstimates && report.xQuery.fields > "") {
      caption += ` including ancestrally derived estimates`;
    }
  }
  return {
    status,
    report: {
      tree: report,
      xQuery,
      yQuery,
      xLabel,
      queryString,
      caption,
    },
  };
};

export const scatterPerRank = async ({
  x,
  y,
  cat,
  rank,
  taxonomy,
  xOpts,
  yOpts,
  scatterThreshold = 100,
  queryString,
  ...apiParams
}) => {
  // Return 2D histogram at a list of ranks
  let ranks = rank ? setRanks(rank) : [undefined];
  let perRank = [];
  let xQuery;
  let yQuery;
  let xLabel;
  let yLabel;
  let status;
  for (rank of ranks.slice(0, 1)) {
    let res = await histogram({
      x,
      y,
      cat,
      rank,
      result: apiParams.result,
      taxonomy,
      xOpts,
      yOpts,
      scatterThreshold,
      report: "scatter",
      apiParams,
    });
    if (res.status.success == false) {
      if (!status) {
        status = res.status;
      }
      perRank.push(res);
    } else {
      perRank.push(res.report);
      xQuery = res.xQuery;
      yQuery = res.yQuery;
      xLabel = res.xLabel;
      yLabel = res.yLabel;
    }
  }
  if (!status) {
    status = { success: true };
  }
  let report = perRank.length == 1 ? perRank[0] : perRank;
  let caption = `Distribution of ${y} with ${x}`;
  if (cat) {
    caption += ` by ${cat}`;
  }
  if (apiParams.includeEstimates) {
    caption += ` including ancestrally derived estimates`;
  }
  return {
    status,
    report: {
      scatter: report,
      xQuery,
      yQuery,
      xLabel,
      yLabel,
      queryString,
      caption,
    },
  };
};

export const histPerRank = async ({
  x,
  xOpts,
  cat,
  taxonomy,
  rank,
  queryString,
  ...apiParams
}) => {
  // Return histogram at a list of ranks
  let ranks = rank ? setRanks(rank) : [undefined];
  let perRank = [];
  let xQuery;
  let xLabel;
  let status;
  for (rank of ranks.slice(0, 1)) {
    let res = await histogram({
      x,
      xOpts,
      cat,
      rank,
      result: apiParams.result,
      taxonomy,
      apiParams,
    });
    if (res.status.success == false) {
      if (!status) {
        status = res.status;
      }
      perRank.push(res);
    } else {
      perRank.push(res.report);
      xQuery = res.xQuery;
      xLabel = res.xLabel;
    }
  }
  if (!status) {
    status = { success: true };
  }
  let report = perRank.length == 1 ? perRank[0] : perRank;
  let caption = `Frequency distribution of ${ranks[0]}`;
  if (x) {
    caption += ` with ${x}`;
  }
  if (cat) {
    caption += ` by ${cat}`;
  }
  if (apiParams.includeEstimates) {
    caption += ` including ancestrally derived estimates`;
  }
  return {
    status,
    report: {
      histogram: report,
      valueType: report.valueType,
      xQuery,
      xLabel,
      yLabel: `Count of ${ranks[0]}`,
      queryString,
      caption,
    },
  };
};

export const xInY = async ({ x, y, result, taxonomy, rank, queryString }) => {
  if (!x) {
    return {
      status: {
        success: false,
        error: `no x query specified`,
      },
    };
  }
  if (!rank) {
    return {
      status: {
        success: false,
        error: `no rank specified`,
      },
    };
  }
  let { params, fields } = queryParams({ term: y, result, taxonomy, rank });
  let yCount = await getResultCount({ ...params });
  let yQuery = { ...params };
  if (fields.length > 0) {
    yQuery.fields = fields.join(",");
  }
  params.query = combineQueries(params.query, x);
  if (rank) {
    params.includeEstimates = true;
    params.excludeAncestral = yQuery.excludeAncestral
      ? [...yQuery.excludeAncestral]
      : [];
    params.excludeMissing = yQuery.excludeMissing
      ? [...yQuery.excludeMissing]
      : [];
    x.split(/\s+(?:and|AND)\s+/).forEach((term) => {
      if (!term.match("tax_")) {
        let field = term.replace(/[^\w_\(\)].+$/, "");
        if (field.match(/\(/)) {
          field = field.split(/[\(\)]/)[1];
        }
        params.excludeAncestral.push(field);
        params.excludeMissing.push(field);
        fields.push(field);
      }
    });
    if (fields.length == 0) {
      fields = ["all"];
    }
  }
  params.excludeMissing = [...new Set(params.excludeMissing)];
  params.excludeAncestral = [...new Set(params.excludeAncestral)];
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

export const xInYPerRank = async ({
  x,
  y,
  result,
  taxonomy,
  rank,
  queryString,
}) => {
  // Return xInY at a list of ranks
  let ranks = rank ? setRanks(rank) : [undefined];
  let perRank = [];
  let status;
  for (rank of ranks) {
    let res = await xInY({ x, y, result, rank, taxonomy });
    if (res.status.success == false) {
      if (!status) {
        status = res.status;
      }
      perRank.push(res);
    } else {
      perRank.push(res.report);
    }
  }
  if (!status) {
    status = { success: true };
  }
  let report;
  let taxa;
  if (perRank.length == 1) {
    report = perRank[0];
    taxa = ranks[0] ? plurals(ranks[0]) : "taxa";
  } else {
    report = perRank;
    taxa = "taxa";
  }
  let caption = taxa;
  if (x) {
    caption += ` with ${x} out of all ${taxa}`;
  }
  if (y) {
    caption += ` with ${y}`;
  }
  return {
    status,
    report: {
      xInY: report,
      queryString,
      caption,
    },
  };
};

export const xPerRank = async ({
  x,
  result = "taxon",
  taxonomy,
  rank,
  queryString,
}) => {
  // Return counts at a list of ranks
  let ranks = setRanks(rank);
  let perRank = [];
  let includeEstimates = x ? false : true;
  for (rank of ranks) {
    let { params, fields } = queryParams({
      term: x,
      result,
      rank,
      taxonomy,
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
      rank: rank && plurals(rank),
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
      if (src && typeof src === "string") {
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
      }
    });
  });
  return sources;
};

export const getNewickString = ({ treeNodes, rootNode }) => {
  if (!treeNodes || !rootNode) return ";";
  const writeNewickString = ({ node }) => {
    if (
      node.hasOwnProperty("children") &&
      Object.keys(node.children).length > 0
    ) {
      let children = Object.keys(node.children).map((key) =>
        writeNewickString({ node: treeNodes[key] })
      );
      return children.length > 1
        ? `(${children.join(",")})${node.scientific_name}`
        : children[0];
    }
    return node.scientific_name;
  };
  let newick = writeNewickString({ node: treeNodes[rootNode] });
  return `${newick};`;
};

export const getPhyloXml = ({
  treeNodes,
  rootNode,
  taxonomy = "ncbi",
  compact = true,
  field,
  meta,
}) => {
  if (!treeNodes || !rootNode) return undefined;

  const writeTaxonomy = ({
    taxon_id,
    scientific_name,
    taxon_rank,
    taxonomy,
  }) => {
    return `<taxonomy><id provider="${taxonomy}">${taxon_id}</id><scientific_name>${scientific_name}</scientific_name><rank>${taxon_rank}</rank></taxonomy>`;
  };

  const writeName = ({ scientific_name }) => {
    return `<name>${scientific_name}</name>`;
  };

  const writeAnnotation = ({ value, source, field, meta }) => {
    if (!source) {
      return "";
    }
    let unit = meta.unit ? `unit="${meta.unit}"` : "";
    let datatype = `datatype="xsd:integer"`;
    let property = `<property ${datatype} ref="GoaT:${field}" applies_to="clade" ${unit}>${value}</property>`;
    return `<annotation evidence="${source}">${property}</annotation>`;
  };

  const writeClade = ({ node }) => {
    let children = [];
    if (
      node.hasOwnProperty("children") &&
      Object.keys(node.children).length > 0
    ) {
      children = Object.keys(node.children).map((key) =>
        writeClade({ node: treeNodes[key] })
      );
    }
    if (compact && children.length == 1) {
      return children[0];
    }
    return `<clade><id>${node.taxon_id}</id>${writeName({
      ...node,
    })}${writeTaxonomy({
      ...node,
      taxonomy,
    })}${
      meta
        ? writeAnnotation({
            ...node,
            field,
            meta,
          })
        : ""
    }${children.join("\n")}</clade>`;
  };
  let tree = writeClade({ node: treeNodes[rootNode] });
  let xml = `<phyloxml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.phyloxml.org http://www.phyloxml.org/1.10/phyloxml.xsd" 
  xmlns="http://www.phyloxml.org">
  <phylogeny rooted="true">
    <name>test</name>
    <description>example tree</description>
    ${tree}
  </phylogeny>
</phyloxml>`;
  return xml;
};

export const getTypes = async (params) => {
  const types = await attrTypes({
    result: params.result,
    indexType: "attributes",
  });
  let byGroup = {};
  Object.keys(types).forEach((key) => {
    let group = types[key].display_group;
    if (!byGroup[group]) {
      byGroup[group] = [];
    }
    byGroup[group].push(key);
  });
  Object.values(byGroup).forEach((values) => {
    values = values.sort((a, b) => a.localeCompare(b));
  });
  return byGroup;
};

module.exports = {
  getReport: async (req, res) => {
    let report = await cacheFetch(req);
    if (!report) {
      report = {};
      let queryString = qs.stringify(req.query);
      switch (req.query.report) {
        case "histogram": {
          report = await histPerRank({ ...req.query, queryString });
          break;
        }
        case "scatter": {
          report = await scatterPerRank({ ...req.query, queryString });
          break;
        }
        case "sources": {
          report = await getSources({ ...req.query, queryString });
          break;
        }
        case "tree": {
          report = await getTree({ ...req.query, queryString });
          break;
        }
        case "types": {
          report = await getTypes({ ...req.query, queryString });
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
      cacheStore(req, report);
    }
    if (report && report != {}) {
      report.name = req.query.report;
      let typesMap;
      if (report.name == "tree") {
        typesMap = await attrTypes({ ...req.query });
      }

      return res.format({
        json: () => {
          res
            .status(200)
            .send(
              formatJson(
                { status: { success: true }, report },
                req.query.indent
              )
            );
        },
        "text/x-nh": () => {
          let { lca, treeNodes } = report.report.tree.tree;
          res
            .status(200)
            .send(getNewickString({ treeNodes, rootNode: lca.taxon_id }));
        },
        "application/xml": () => {
          let { lca, treeNodes } = report.report.tree.tree;
          let fields = report.report.tree.xQuery.fields;
          let meta;
          let field;
          if (fields) {
            if (Array.isArray(fields)) {
              field = fields[0];
              meta = typesMap[fields[0]];
            } else {
              field = fields.replace(/,.+/, "");
              meta = typesMap[field];
            }
          }
          res
            .status(200)
            .send(
              getPhyloXml({ treeNodes, rootNode: lca.taxon_id, field, meta })
            );
        },
      });
    }
    return res.status(404).send({ status: "error" });
  },
};
