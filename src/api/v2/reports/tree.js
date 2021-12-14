import { getResults, parseFields, setExclusions } from "../routes/search";
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
import { setProgress } from "../functions/progress";

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

    // if (taxon) {
    let child;
    let depthChange = 0;
    for (let ancestor of res.results[0].result.lineage) {
      depthChange++;
      if (ancestor.taxon_id == taxon_id) {
        depthChange = 0;
      }
      if (
        taxon &&
        (ancestor.taxon_id.toLowerCase() == taxon ||
          ancestor.scientific_name.toLowerCase() == taxon)
      ) {
        minDepth += depthChange;
        maxDepth += depthChange;
        taxon_id = ancestor.taxon_id;
        child = taxon_id;
      } else if (child) {
        parent = ancestor.taxon_id;
        break;
      } else if (taxon_id == ancestor.taxon_id) {
        child = taxon_id;
      }
    }
    // }

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

const chunkArray = (arr, chunkSize) => {
  if (chunkSize <= 0) throw "Invalid chunk size";
  let chunks = [];
  for (let i = 0, len = arr.length; i < len; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
};

// TODO: tune chunkSize parameter
const chunkSize = 100;

const addXResultsToTree = async ({
  xRes,
  treeNodes,
  optionalFields,
  lca,
  xQuery,
  update,
  yRes,
  ancStatus,
  queryId,
}) => {
  let isParentNode = {};
  let lineages = {};
  if (!ancStatus) {
    ancStatus = new Set();
  }

  for (let result of xRes.results) {
    let treeFields;
    // let status = y ? 0 : 1;
    let source;
    if (result.result.fields) {
      treeFields = {};
      for (let f of optionalFields) {
        if (result.result.fields[f]) {
          let {
            aggregation_source: source,
            value,
            min,
            max,
            range,
          } = result.result.fields[f];
          treeFields[f] = {
            source,
            value,
            ...(min && { min }),
            ...(max && { max }),
          };
        }
      }
    }
    if (update) {
      if (treeFields) {
        treeNodes[result.result.taxon_id].fields = treeFields;
        treeNodes[result.result.taxon_id].status = ancStatus.has(
          result.result.taxon_id
        )
          ? 1
          : 0;
      }
      continue;
    } else {
      treeNodes[result.result.taxon_id] = {
        count: 0,
        children: {},
        taxon_id: result.result.taxon_id,
        scientific_name: result.result.scientific_name,
        taxon_rank: result.result.taxon_rank,
        ...(treeFields && { fields: treeFields }),
      };
      isParentNode[result.result.parent] = true;
      lineages[result.result.taxon_id] = result.result.lineage;
    }
  }
  if (update) {
    return;
  }

  if (yRes) {
    let yCount = 0;
    for (let result of yRes.results) {
      if (!treeNodes[result.result.taxon_id]) {
        continue;
      }
      yCount++;
      treeNodes[result.result.taxon_id].status = 1;
    }
    lca.yCount = yCount;
  }

  let missingIds = new Set();

  for (let result of xRes.results) {
    let child = result.result.taxon_id;
    let status = treeNodes[result.result.taxon_id].status;
    if (!isParentNode[result.result.taxon_id]) {
      treeNodes[child].count = 1;
      if (lineages[result.result.taxon_id]) {
        for (let ancestor of lineages[result.result.taxon_id]) {
          if (ancestor.taxon_id == child) {
            continue;
          }
          if (ancestor.taxon_id == lca.parent) {
            break;
          }
          if (status) {
            ancStatus.add(ancestor.taxon_id);
          }
          if (!treeNodes[ancestor.taxon_id]) {
            missingIds.add(ancestor.taxon_id);
            treeNodes[ancestor.taxon_id] = {
              count: 0,
              children: {},
              scientific_name: ancestor.scientific_name,
              taxon_rank: ancestor.taxon_rank,
              taxon_id: ancestor.taxon_id,
            };
          }
          treeNodes[ancestor.taxon_id].count += 1;
          treeNodes[ancestor.taxon_id].children[child] = true;
          child = ancestor.taxon_id;
          if (ancestor.taxon_id == lca.taxon_id) {
            continue;
          }
        }
      }
    }
  }
  if (missingIds.size > 0) {
    let x = 0;
    if (queryId) {
      setProgress(queryId, { x: 0, total: missingIds.size });
    }
    for (let chunk of chunkArray([...missingIds], chunkSize)) {
      let mapped = []; // xQuery.query.split(/\s+AND\s+/i);
      mapped = mapped.filter((term) => !term.startsWith("tax_"));
      mapped.unshift(`tax_eq(taxon_id:${chunk.join(",taxon_id:")})`);
      let newQuery = { ...xQuery, query: mapped.join(" AND ") };
      // TODO: review newQuery options
      let newRes = await getResults(newQuery);
      await addXResultsToTree({
        xRes: newRes,
        treeNodes,
        optionalFields,
        lca,
        xQuery: newQuery,
        update: true,
        ancStatus,
        queryId,
      });
      x = Math.min(missingIds.size, x + chunkSize);
      setProgress(queryId, { x });
    }
  }
};

const getTree = async ({
  params,
  x,
  y,
  yParams,
  fields,
  yFields,
  optionalFields,
  cat,
  result,
  treeThreshold = config.treeThreshold,
  queryId,
  req,
}) => {
  cat = undefined;
  let typesMap = await attrTypes({ result });
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
  let maxDepth = lca.maxDepth;
  let mapped = params.query.split(/\s+(?:AND|and)\s+/);
  let yMapped = yParams.query.split(/\s+(?:AND|and)\s+/);
  // TODO: include descendant values when include estimates is false and minDepth > tax_depth
  let match = params.query.match(/tax_depth\s*\((.+?)\)/);
  if (match) {
    if (match[1] > maxDepth) {
      return {
        lca,
        status: {
          success: false,
          error: `tax_depth greater than tree depth\nConsider reducing to 'tax_depth(${maxDepth})'`,
        },
      };
    }
  }
  let yMatch = params.query.match(/tax_depth\s*\((.+?)\)/);
  if (yMatch) {
    if (yMatch[1] > maxDepth) {
      return {
        lca,
        status: {
          success: false,
          error: `tax_depth greater than tree depth\nConsider reducing to 'tax_depth(${maxDepth})'`,
        },
      };
    }
  }
  // mapped = mapped.map((term) => {
  //   if (term.startsWith("tax_depth")) {
  //     let parts = term.split(/[\(\)]/);
  //     if (!params.includeEstimates) {
  //       if (lca.minDepth > parts[1]) {
  //         params.includeEstimates = "descendant";
  //         lca.taxDepth = parts[1] * 1;
  //       }
  //     }
  //     return `tax_depth(${Math.min(parts[1], maxDepth)})`;
  //   } else {
  //     return term;
  //   }
  // });
  // yMapped = yMapped.map((term) => {
  //   if (term.startsWith("tax_depth")) {
  //     let parts = term.split(/[\(\)]/);
  //     if (!params.includeEstimates) {
  //       if (lca.minDepth > parts[1]) {
  //         params.includeEstimates = "descendant";
  //       }
  //     }
  //     return `tax_depth(${Math.min(parts[1], maxDepth)})`;
  //   } else {
  //   return term;
  //   }
  // });

  let xQuery = {
    ...params,
    query: mapped.join(" AND "),
    size: treeThreshold, // lca.count,
    // maxDepth,
    lca: lca,
    fields,
    optionalFields,
    exclusions,
  };
  if (queryId) {
    setProgress(queryId, { total: lca.count });
  }
  let xRes = await getResults({ ...xQuery, req, update: "x" });

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
      req,
      update: "y",
    });
  }
  let treeNodes = {};
  await addXResultsToTree({
    xRes,
    treeNodes,
    optionalFields,
    lca,
    xQuery,
    yRes,
    queryId,
  });

  return { lca, treeNodes };
};

export const tree = async ({ x, y, cat, result, apiParams, req }) => {
  let typesMap = await attrTypes({ result });
  let searchFields = await parseFields({ result, fields: apiParams.fields });
  let { params, fields, summaries } = queryParams({
    term: x,
    result,
  });
  fields = searchFields;
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
    : false;
  yParams.includeEstimates = params.includeEstimates;
  params.excludeDirect = apiParams.excludeDirect || [];
  params.excludeDescendant = apiParams.excludeDescendant || [];
  params.excludeAncestral = apiParams.excludeAncestral || [];
  params.excludeMissing = apiParams.excludeMissing || [];

  yParams.excludeDirect = apiParams.excludeDirect || [];
  yParams.excludeDescendant = apiParams.excludeDescendant || [];
  yParams.excludeAncestral = apiParams.excludeAncestral || [];
  yParams.excludeMissing = apiParams.excludeMissing || [];

  // if (params.includeEstimates) {
  //   delete params.excludeAncestral;
  //   delete yParams.excludeAncestral;
  // }

  // delete params.excludeDescendant;
  // delete yParams.excludeDescendant;

  let xQuery = { ...params };
  let yQuery = { ...yParams };

  let optionalFields = [...fields, ...yFields];
  if (apiParams.fields) {
    optionalFields = optionalFields.concat(apiParams.fields.split(","));
  }
  optionalFields = [...new Set([...optionalFields])];

  let treeThreshold = `${apiParams.treeThreshold}` || config.treeThreshold;
  if (treeThreshold < 0) {
    treeThreshold = 100000;
  }
  let tree = status
    ? {}
    : await getTree({
        params,
        fields,
        optionalFields,
        summaries,
        cat,
        x,
        y,
        yParams,
        yFields,
        ySummaries,
        result,
        treeThreshold,
        queryId: apiParams.queryId,
        req,
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
        fields: optionalFields.join(","),
      },
      ...(y && {
        yQuery: {
          ...yQuery,
          fields: optionalFields.join(","),
          yFields,
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
