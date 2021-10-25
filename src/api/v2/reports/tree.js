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
    } else if (buckets.length == 2) {
      parent = buckets[1].key;
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
  cat,
  result,
}) => {
  let typesMap = await attrTypes({ result });
  // fields.push(...yFields);
  let field = yFields[0] || fields[0];
  let exclusions;
  params.excludeUnclassified = true;
  exclusions = setExclusions(params);
  let lca = await getLCA({ params: { ...params }, exclusions });
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
    size: 10000, // lca.count,
    maxDepth,
    lca: lca,
    fields,
    optionalFields: yFields,
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
    yParams.excludeUnclassified = true;
    exclusions = setExclusions(yParams);
    yRes = await getResults({
      ...yParams,
      query: yMapped.join(" AND "),
      size: 10000, // lca.count,
      maxDepth,
      fields: yFields,
      exclusions,
    });
  }

  for (let result of xRes.results) {
    let source, value;
    let status = y ? 0 : 1;
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
  let { params, fields, summaries } = queryParams({
    term: x,
    result,
  });
  let {
    params: yParams,
    fields: yFields,
    summaries: ySummaries,
  } = queryParams({
    term: y ? `${x} AND ${y}` : x,
    result,
  });
  params.includeEstimates = apiParams.hasOwnProperty("includeEstimates")
    ? apiParams.includeEstimates
    : true;
  yParams.includeEstimates = params.includeEstimates;
  // delete params.excludeAncestral;
  // delete yParams.excludeAncestral;
  delete params.excludeDescendant;
  delete yParams.excludeDescendant;

  let xQuery = { ...params };
  let yQuery = { ...yParams };
  let typesMap = await attrTypes({ result });

  let tree = await getTree({
    params,
    fields,
    summaries,
    cat,
    y,
    yParams,
    yFields,
    ySummaries,
    result,
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
        fields: fields.concat(yFields).join(","),
      },
      ...(y && {
        yQuery: {
          ...yQuery,
          fields: yFields.join(","),
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
