import { getResults, setExclusions } from "../routes/search";
import { scaleLinear, scaleLog, scaleSqrt } from "d3-scale";

import { aInB } from "../functions/aInB";
import { attrTypes } from "../functions/attrTypes";
import { checkResponse } from "../functions/checkResponse";
import { client } from "../functions/connection";
import { combineQueries } from "../functions/combineQueries";
import { config } from "../functions/config";
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

const getLCA = async ({
  params,
  fields,
  summaries,
  result,
  exclusions,
  apiParams,
}) => {
  params.size = 1;
  params.aggs = {
    by_lineage: {
      nested: {
        path: "lineage",
      },
      aggs: {
        ancestors: {
          terms: { field: "lineage.taxon_id", size: 100 },
          aggs: {
            types_count: { value_count: { field: "lineage.taxon_id" } },
            min_depth: {
              min: { field: "lineage.node_depth" },
            },
            max_depth: {
              max: { field: "lineage.node_depth" },
            },
            ancestor_bucket_sort: {
              bucket_sort: {
                sort: [
                  { types_count: { order: "desc" } },
                  { min_depth: { order: "asc" } },
                ],
                size: 2,
              },
            },
          },
        },

        // max_ancestor_count: {
        //   max_bucket: {
        //     buckets_path: "ancestors>doc_count",
        //   },
        // },
      },
    },
  };
  let query = params.query;
  let maxDepth;
  let taxon;
  if (query) {
    let match = query.match(/tax_tree\((.+?)\)/);
    if (match) {
      maxDepth = 100;
      taxon = match[1].toLowerCase();
    }
  }
  let res = await getResults({
    ...params,
    fields: [],
    query,
    exclusions,
    maxDepth: 100,
    lca: { maxDepth: 100 },
  });

  let buckets;
  try {
    buckets = res.aggs.by_lineage.ancestors.buckets;
  } catch (err) {
    {
      let filtered = query.split(/\s+(?:AND|and)\s+/);
      if (query.match("tax_depth")) {
        filtered = filtered.filter((term) => !term.startsWith("tax_depth"));
      }
      res = await getResults({
        ...params,
        fields: [],
        query: filtered.join(" AND "),
        exclusions,
        maxDepth: 100,
        lca: { maxDepth: 100 },
      });
      if (!res.aggs) {
        return {};
      }
      buckets = res.aggs.by_lineage.ancestors.buckets;
    }
  }
  let bucket;
  let lca;
  if (buckets.length >= 1) {
    bucket = buckets[0];
    let maxDepth = bucket.max_depth.value;
    let minDepth = bucket.min_depth.value;
    let taxon_id = bucket.key;
    let parent;

    if (taxon) {
      let child;
      let depthChange = 0;
      for (let ancestor of res.results[0].result.lineage) {
        depthChange++;
        if (ancestor.taxon_id == taxon_id) {
          depthChange = 0;
        }
        if (
          ancestor.taxon_id.toLowerCase() == taxon ||
          ancestor.scientific_name.toLowerCase() == taxon
        ) {
          minDepth += depthChange;
          maxDepth += depthChange;
          taxon_id = ancestor.taxon_id;
          child = taxon_id;
        } else if (child) {
          parent = ancestor.taxon_id;
          break;
        }
      }
    }

    lca = {
      taxon_id,
      count: bucket.doc_count,
      maxDepth,
      minDepth,
      parent,
    };
  }
  return lca;
};

const getTree = async ({
  params,
  y,
  yParams,
  fields,
  yFields,
  optionalFields,
  cat,
  result,
  treeThreshold = config.treeThreshold,
}) => {
  cat = undefined;
  let typesMap = await attrTypes({ result });
  // fields.push(...yFields);
  let field = yFields[0] || fields[0];
  let exclusions;
  params.excludeUnclassified = true;
  exclusions = setExclusions(params);
  let lca = await getLCA({ params: { ...params }, exclusions });
  if (treeThreshold > -1 && lca.count > treeThreshold) {
    return {
      status: {
        success: false,
        error: `Trees currently limited to ${treeThreshold} nodes (x query returns ${lca.count} taxa).\nPlease specify additional filters to continue.`,
      },
    };
  }
  let treeNodes = {};
  let maxDepth = lca.maxDepth;
  let mapped = params.query.split(/\s+(?:AND|and)\s+/);
  let yMapped = yParams.query.split(/\s+(?:AND|and)\s+/);
  // TODO: include descendant values when include estimates is false and minDepth > tax_depth
  if (params.query.match("tax_depth")) {
    mapped = mapped.map((term) => {
      if (term.startsWith("tax_depth")) {
        let parts = term.split(/[\(\)]/);
        if (!params.includeEstimates) {
          if (lca.minDepth > parts[1]) {
            params.includeEstimates = "descendant";
            lca.taxDepth = parts[1] * 1;
          }
        }
        return `tax_depth(${Math.min(parts[1], maxDepth)})`;
      } else {
        return term;
      }
    });
    yMapped = yMapped.map((term) => {
      if (term.startsWith("tax_depth")) {
        let parts = term.split(/[\(\)]/);
        if (!params.includeEstimates) {
          if (lca.minDepth > parts[1]) {
            params.includeEstimates = "descendant";
          }
        }
        return `tax_depth(${Math.min(parts[1], maxDepth)})`;
      } else {
        return term;
      }
    });
  }
  let xRes = await getResults({
    ...params,
    query: mapped.join(" AND "),
    size: treeThreshold, // lca.count,
    maxDepth,
    lca: lca,
    fields,
    optionalFields,
    exclusions,
  });

  let isParentNode = {};
  let lineages = {};
  let yRes;
  if (y) {
    yParams.excludeMissing.push(...yFields);
    if (cat && typesMap[cat]) {
      yParams.excludeMissing.push(cat);
    }
    yParams.excludeMissing = [...new Set(yParams.excludeMissing)];
    yParams.excludeUnclassified = true;
    exclusions = setExclusions(yParams);
    yRes = await getResults({
      ...yParams,
      query: yMapped.join(" AND "),
      size: treeThreshold, // lca.count,
      maxDepth,
      fields: yFields,
      exclusions,
    });
  }

  for (let result of xRes.results) {
    let source, value;
    let status = y ? 0 : 1;
    // for (let f of optionalFields) {
    //   console.log(f);
    //   if (result.result.fields && result.result.fields[f]) {
    //     console.log(result.result.fields[f]);
    //   }
    // }
    // break;
    if (field && result.result.fields && result.result.fields[field]) {
      source =
        result.result.fields[field].aggregation_source != "ancestor"
          ? "descendant"
          : "ancestor";
      value = result.result.fields[field].value;
      status = y ? (source == "ancestor" ? 0 : 1) : 1;
      source = y ? "ancestor" : source;
    }
    if (
      field &&
      // field != "undefined" &&
      params.includeEstimates == "descendant"
    ) {
      status = 1;
      source = "descendant";
    }
    treeNodes[result.result.taxon_id] = {
      count: 0,
      children: {},
      taxon_id: result.result.taxon_id,
      scientific_name: result.result.scientific_name,
      taxon_rank: result.result.taxon_rank,
      source,
      value,
      status,
      // fields: result.result.fields,
    };
    isParentNode[result.result.parent] = true;
    lineages[result.result.taxon_id] = result.result.lineage;
  }

  for (let result of xRes.results) {
    // for (let [taxon_id, obj] of Object.entries(treeNodes)){
    let child = result.result.taxon_id;
    if (!isParentNode[result.result.taxon_id]) {
      treeNodes[child].count = 1;
      if (lineages[result.result.taxon_id]) {
        for (let ancestor of lineages[result.result.taxon_id]) {
          if (ancestor.taxon_id == result.result.taxon_id) {
            continue;
          }
          if (!treeNodes[ancestor.taxon_id]) {
            treeNodes[ancestor.taxon_id] = {
              count: 0,
              children: {},
              scientific_name: ancestor.scientific_name,
              taxon_rank: ancestor.taxon_rank,
              status: 0,
              taxon_id: ancestor.taxon_id,
              // source,
              // value,
              // status,
              // fields: result.result.fields,
            };
          }
          if (
            treeNodes[ancestor.taxon_id].status == 0 &&
            treeNodes[child].status == 1
          ) {
            treeNodes[ancestor.taxon_id].status = 1;
          }

          treeNodes[ancestor.taxon_id].count += 1;
          treeNodes[ancestor.taxon_id].children[child] = true;
          child = ancestor.taxon_id;
        }
      }
    }
  }
  if (yRes) {
    for (let result of yRes.results) {
      // for (let [taxon_id, obj] of Object.entries(treeNodes)){
      if (!treeNodes[result.result.taxon_id]) {
        continue;
      }
      if (!result.result.fields) {
        continue;
      }
      treeNodes[result.result.taxon_id].status = 1;
      let source = result.result.fields[field].aggregation_source;
      treeNodes[result.result.taxon_id].source = source;
      let child = result.result.taxon_id;
      if (lineages[result.result.taxon_id]) {
        for (let ancestor of lineages[result.result.taxon_id]) {
          if (
            treeNodes[ancestor.taxon_id].status == 0 &&
            treeNodes[child].status == 1
          ) {
            treeNodes[ancestor.taxon_id].status = 1;
          }
          if (
            (!treeNodes[ancestor.taxon_id].source ||
              treeNodes[ancestor.taxon_id].source == "ancestor") &&
            treeNodes[child].source != "ancestor"
          ) {
            treeNodes[ancestor.taxon_id].source = "descendant";
          }
        }
      }
    }
    lca.yCount = yRes.results.length;
  }
  // return xRes;

  return { lca, treeNodes };

  let hist = undefined; // res.aggs.aggregations[field].histogram;
  if (!hist) {
    return xRes;
  }
  return hist;
};

export const tree = async ({ x, y, cat, result, apiParams }) => {
  let typesMap = await attrTypes({ result });
  let { params, fields, summaries } = queryParams({
    term: x,
    result,
  });
  let status;
  if (!x || !aInB(fields, Object.keys(typesMap))) {
    status = {
      success: false,
      error: `unknown field in 'x = ${x}'`,
    };
  }
  let yTerm = combineQueries(x, y);
  let {
    params: yParams,
    fields: yFields,
    summaries: ySummaries,
  } = queryParams({
    term: yTerm,
    result,
  });
  if (y && !aInB(yFields, Object.keys(typesMap))) {
    status = {
      success: false,
      error: `unknown field in 'x = ${y}'`,
    };
  }
  params.includeEstimates = apiParams.hasOwnProperty("includeEstimates")
    ? apiParams.includeEstimates
    : true;
  yParams.includeEstimates = params.includeEstimates;
  if (params.includeEstimates) {
    delete params.excludeAncestral;
    delete yParams.excludeAncestral;
  }

  delete params.excludeDescendant;
  delete yParams.excludeDescendant;

  let xQuery = { ...params };
  let yQuery = { ...yParams };

  let optionalFields = [
    ...new Set([...fields, ...yFields, ...apiParams.fields.split(",")]),
  ];

  const treeThreshold = apiParams.treeThreshold || config.treeThreshold;
  let tree = status
    ? {}
    : await getTree({
        params,
        fields,
        optionalFields,
        summaries,
        cat,
        y,
        yParams,
        yFields,
        ySummaries,
        result,
        treeThreshold,
      });

  if (tree && tree.status && tree.status.success == false) {
    status = tree.status;
  }

  return {
    status: { success: true },
    report: {
      status,
      tree,
      xQuery: {
        ...xQuery,
        fields: [...new Set(fields.concat(yFields))].join(","),
      },
      ...(y && {
        yQuery: {
          ...yQuery,
          fields: [...new Set(yFields)].join(","),
        },
      }),
      x: tree.lca ? tree.lca.count : 0,
      ...(y && { y: tree.lca && tree.lca.yCount ? tree.lca.yCount : 0 }),
    },
    xQuery,
    ...(y && { yQuery }),
    xLabel: fields[0],
    ...(y && { yLabel: yFields[0] }),
  };
};
