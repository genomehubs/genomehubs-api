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

const scales = {
  linear: scaleLinear,
  log: scaleLog,
  log10: scaleLog,
  log2: () => scaleLog().base(2),
  sqrt: scaleSqrt,
};
const fmt = format(".8r");

const getCatLabels = async ({
  result,
  cat,
  cats,
  apiParams,
  key = "scientific_name",
}) => {
  let index = indexName(apiParams);
  let qBody = [];
  let labels = [];
  cats.forEach((obj) => {
    qBody.push({ index });
    qBody.push({ id: "taxon_by_name", params: { taxon: obj.key, rank: cat } });
  });
  const { body } = await client
    .msearchTemplate({
      body: qBody,
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      return err.meta;
    });
  body.responses.forEach((doc, i) => {
    if (doc.hits.total == 1) {
      let label = cats[i];
      label.label = doc.hits.hits[0]._source[key];
      labels.push(label);
    }
  });
  return labels;
};

const setTerms = async ({ cat, typesMap, apiParams }) => {
  let size = 5;
  let other;
  if (cat.endsWith("+")) {
    cat = cat.replace(/\+$/, "");
    other = true;
  }
  let portions = cat.split(/\s*[\[\]]\s*/);
  if (portions.length > 1) {
    size = portions[1];
    delete portions[1];
    cat = portions.join("");
    other = other || false;
  }
  if (!cat.match(/\s*[=,]\s*/)) {
    if (other === false) {
      other = undefined;
    } else {
      other = true;
    }
    return { cat, size, other };
  }
  let parts = cat.split(",");
  let field;
  let terms = [];
  let by;
  parts.forEach((part) => {
    let bits = part.split("=");
    let value;
    if (bits.length == 2) {
      field = bits[0];
      value = bits[1];
    } else {
      value = bits[0];
    }
    terms.push({ key: value });
  });
  if (typesMap[field]) {
    by = "attribute";
  } else {
    by = "lineage";
    // lookup taxon_id if not attribute
    let cats = await getCatLabels({
      cat: field,
      cats: terms,
      apiParams,
      key: "taxon_id",
    });
    // invert key and label
    terms = [];
    cats.forEach((obj) => {
      terms.push({ key: obj.label, label: obj.key });
    });
  }
  return { cat: field, terms, by, size, other };
};

const getBounds = async ({
  params,
  fields,
  cat,
  result,
  exclusions,
  tickCount = 10,
  apiParams,
}) => {
  let typesMap = await attrTypes({ result });

  params.size = 0;
  // find max and min plus most frequent categories
  let field = fields[0];
  let definedTerms = await setTerms({ cat, typesMap, apiParams });
  cat = definedTerms.cat;
  let extraTerms;
  if (definedTerms.terms) {
    if (definedTerms.terms.length < definedTerms.size) {
      extraTerms = cat;
    }
  } else {
    extraTerms = cat;
  }
  params.aggs = await setAggs({
    field,
    result,
    stats: true,
    terms: extraTerms,
    size: definedTerms.size,
  });
  let res = await getResults({ ...params, exclusions });
  let aggs = res.aggs.aggregations[field];
  let stats = aggs.stats;
  if (!stats) {
    return;
  }
  // Set domain to nice numbers
  let max = stats.max;
  let min = stats.min;
  let scale = scales[typesMap[field].bins.scale || "linear"]().domain([
    min,
    max,
  ]);
  let ticks = scale.ticks(tickCount);
  let gap = ticks[1] - ticks[0];
  let niceMin = 1 * fmt(ticks[0] - gap * Math.ceil((ticks[0] - min) / gap));
  let lastTick = ticks[ticks.length - 1];
  let niceMax = 1 * fmt(lastTick + gap * Math.ceil((max - lastTick) / gap));
  let domain = [niceMin, niceMax];
  let terms = aggs.terms;
  let cats;
  let by;
  if (terms) {
    if (terms.by_lineage) {
      cats = terms.by_lineage.at_rank.taxa.buckets;
      cats = await getCatLabels({ cat, result, cats, apiParams });
      by = "lineage";
    } else {
      cats = terms.by_attribute.by_cat.cats.buckets;
      cats.forEach((obj) => {
        obj.label = obj.key;
      });
      by = "attribute";
    }
  }
  if (definedTerms && definedTerms.terms) {
    let definedCats = [...definedTerms.terms];
    let catKeys = {};
    definedCats.forEach((obj) => {
      catKeys[obj.key] = true;
      if (!obj.label) {
        obj.label = obj.key;
      }
    });
    if (cats) {
      for (let i = 0; i < cats.length; i++) {
        let obj = cats[i];
        if (!catKeys[obj.key]) {
          definedCats.push(obj);
        }
        if (definedCats.length == definedTerms.size) {
          break;
        }
      }
    }
    cats = definedCats;
    by = definedTerms.by;
  }
  return { stats, domain, tickCount, cats, by, showOther: definedTerms.other };
};

const getHistogram = async ({ params, fields, result, exclusions, bounds }) => {
  let typesMap = await attrTypes({ result });
  params.size = 0;
  // find max and min plus most frequent categories
  let field = fields[0];
  params.aggs = await setAggs({
    field,
    result,
    histogram: true,
    bounds,
  });
  let res = await getResults({ ...params, exclusions });
  let hist = res.aggs.aggregations[field].histogram;
  if (!hist) {
    return;
  }
  let buckets = [];
  let allValues = [];
  let other = [];
  hist.buckets.forEach((obj) => {
    buckets.push(obj.key);
    allValues.push(obj.doc_count);
    if (bounds.showOther) {
      other.push(obj.doc_count);
    }
  });
  let scale = scales[typesMap[field].bins.scale || "linear"]()
    .domain(bounds.domain)
    .range([buckets[0], buckets[buckets.length - 1]]);
  buckets = buckets.map((value) => 1 * fmt(scale.invert(value)));
  let catHists = res.aggs.aggregations[field].categoryHistograms;
  let byCat;
  if (catHists) {
    let catBuckets;
    byCat = {};
    if (bounds.by == "attribute") {
      catBuckets = catHists.by_attribute.by_cat.buckets;
    } else {
      if (bounds.showOther) {
        byCat.other = other;
      }
      catBuckets = catHists.by_lineage.at_rank.buckets;
    }
    Object.entries(catBuckets).forEach(([key, obj]) => {
      byCat[key] = [];
      obj.histogram.by_attribute[field].histogram.buckets.forEach((bin, i) => {
        byCat[key][i] = bin.doc_count;
        if (byCat.other) {
          byCat.other[i] -= bin.doc_count;
        }
      });
    });
    if (byCat.other && byCat.other.reduce((a, b) => a + b, 0) == 0) {
      delete byCat.other;
    }
  }
  return { buckets, allValues, byCat };
};

export const histogram = async ({
  x,
  cat,
  result,
  rank,
  includeEstimates,
  queryString,
  apiParams,
}) => {
  let { params, fields } = queryParams({ term: x, result, rank });
  let xQuery = { ...params };
  let exclusions;
  if (apiParams.includeEstimates) {
    delete params.excludeAncestral;
  }
  exclusions = setExclusions(params);
  let bounds = await getBounds({
    params: { ...params },
    fields,
    cat,
    result,
    exclusions,
    apiParams,
  });
  let histograms;
  if (!bounds.cats || bounds.cats.length > 0) {
    histograms = await getHistogram({
      params,
      fields,
      cat,
      result,
      exclusions,
      bounds,
    });
    if (histograms.byCat && histograms.byCat.other) {
      bounds.cats.push({
        key: "other",
        label: "other",
        doc_count: histograms.byCat.other.reduce((a, b) => a + b, 0),
      });
    }
  }

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
      histograms,
      ...bounds,
      xQuery: {
        ...xQuery,
        fields: fields.join(","),
        ranks: [rank, cat].join(","),
      },
      x: histograms ? histograms.allValues.reduce((a, b) => a + b, 0) : 0,
    },
    xQuery,
    xLabel: fields[0],
  };
};
