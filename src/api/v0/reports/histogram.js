import { getResults, setExclusions } from "../routes/search";
import { scaleLinear, scaleLog, scaleSqrt } from "d3-scale";

import { attrTypes } from "../functions/attrTypes";
import { format } from "d3-format";
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

const getBounds = async ({
  params,
  fields,
  cat,
  result,
  exclusions,
  tickCount = 10,
}) => {
  let typesMap = await attrTypes({ result });

  params.size = 0;
  // find max and min plus most frequent categories
  let field = fields[0];
  params.aggs = await setAggs({
    field,
    result,
    stats: true,
    terms: cat,
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
  if (terms) {
    cats = terms.by_lineage.at_rank.taxa.buckets;
  }
  return { stats, domain, tickCount, cats };
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
    other.push(obj.doc_count);
  });
  let scale = scales[typesMap[field].bins.scale || "linear"]()
    .domain(bounds.domain)
    .range([buckets[0], buckets[buckets.length - 1]]);
  buckets = buckets.map((value) => 1 * fmt(scale.invert(value)));
  let catHists = res.aggs.aggregations[field].categoryHistograms;
  let byCat;
  if (catHists) {
    byCat = { other };
    Object.entries(catHists.by_lineage.at_rank.buckets).forEach(
      ([key, obj]) => {
        byCat[key] = [];
        obj.histogram.by_attribute[field].histogram.buckets.forEach(
          (bin, i) => {
            byCat[key][i] = bin.doc_count;
            byCat.other[i] -= bin.doc_count;
          }
        );
      }
    );
  }
  return { buckets, allValues, byCat };
};

export const histogram = async ({ x, cat, result, rank, queryString }) => {
  let { params, fields } = queryParams({ term: x, result, rank });
  let exclusions = setExclusions(params);
  let bounds = await getBounds({
    params: { ...params },
    fields,
    cat,
    result,
    exclusions,
  });
  let histograms = await getHistogram({
    params,
    fields,
    cat,
    result,
    exclusions,
    bounds,
  });
  if (histograms.byCat) {
    bounds.cats = bounds.cats.map((obj) => {
      obj.label = obj.key;
      return obj;
    });
    if (histograms.byCat.other) {
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

  return { status: { success: true }, report: { histograms, ...bounds } };
};
