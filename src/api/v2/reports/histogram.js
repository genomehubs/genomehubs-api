import { getResults, setExclusions } from "../routes/search";
import { scaleLinear, scaleLog, scaleSqrt } from "d3-scale";

import { aInB } from "../functions/aInB";
import { attrTypes } from "../functions/attrTypes";
import { checkResponse } from "../functions/checkResponse";
import { client } from "../functions/connection";
import { combineQueries } from "../functions/combineQueries";
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

const valueTypes = {
  long: "integer",
  integer: "integer",
  short: "integer",
  byte: "integer",
  date: "date",
  keyword: "keyword",
};

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
  if (body.responses) {
    body.responses.forEach((doc, i) => {
      if (doc.hits.total == 1) {
        let label = cats[i];
        label.label = doc.hits.hits[0]._source[key];
        labels.push(label);
      }
    });
  }

  return labels;
};

const setTerms = async ({ cat, typesMap, apiParams }) => {
  let size = 5;
  let other;
  if (!cat) {
    return { cat, size, other };
  }
  if (cat && cat.endsWith("+")) {
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

const precision = (val) => {
  if (!isFinite(val)) return 0;
  let exp = 1,
    prec = 0;
  while (Math.round(val * exp) / exp !== val) {
    exp *= 10;
    prec++;
  }
  return prec;
};

const incrementFloat = (val) => {
  let prec = precision(val);
  val += 10 ** -prec;
  return val;
};

const incrementDate = (val) => {
  let date = new Date(val);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date.getTime();
};

const getBounds = async ({
  params,
  fields,
  summaries,
  cat,
  result,
  exclusions,
  tickCount = 10,
  apiParams,
  opts,
}) => {
  let typesMap = await attrTypes({ result });
  params.size = 0;
  // find max and min plus most frequent categories
  let field = fields[0];
  let summary = summaries[0];
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
  if (fields) {
    if (cat && typesMap[cat]) {
      fields.push(cat);
    }
  }
  params.aggs = await setAggs({
    field,
    summary,
    result,
    stats: true,
    terms: extraTerms,
    size: definedTerms.size,
  });
  let res = await getResults({
    ...params,
    fields,
    exclusions,
  });
  let aggs;
  try {
    aggs = res.aggs.aggregations[field];
  } catch {
    return;
  }
  let stats = aggs.stats;
  if (!stats) {
    return;
  }
  // Set domain to nice numbers
  let min, max;
  if (opts) {
    opts = opts.split(",");
    if (opts[0] && opts[0] > "") {
      min = opts[0];
    }
    if (opts[1] && opts[1] > "") {
      max = opts[1];
    }
    if (opts[2] && opts[2] > "") {
      tickCount = opts[2];
    }
  }
  if (!min || !max) {
    let valueType = valueTypes[typesMap[field].type] || "float";
    if (stats.min == stats.max) {
      tickCount = 2;
      if (valueType == "date") {
        min = stats.min;
        max = incrementDate(stats.max);
      } else if (valueType == "float" || valueType == "integer") {
        min = Number.parseFloat(stats.min).toPrecision(3);
        if (min > stats.min) {
          let [val, exp] = min.split("e");
          min = val.split("");
          for (let i = min.length - 1; i >= 0; i--) {
            if (min[i] == 0) {
              min[i] = 9;
            } else if (min[i] != ".") {
              min[i] = min[i] * 1 - 1;
              break;
            }
          }
          min = min.join("");
          if (exp) {
            min += `e${exp}`;
          }
        }
        let [val, exp] = min.split("e");
        max = val.split("");
        for (let i = max.length - 1; i >= 0; i--) {
          if (i > 0 && max[i] == 9) {
            max[i] = 0;
          } else if (max[i] != ".") {
            max[i] = max[i] * 1 + 1;
            break;
          }
        }
        max = max.join("");
        if (exp) {
          max += `e${exp}`;
        }
      }
    } else if (typesMap[field].type == "date") {
      min = stats.min;
      max = stats.max;
    } else {
      let scaleType = (typesMap[field].bins.scale || "linear").toLowerCase();
      let tmpMin = typeof min == "undefined" ? stats.min : min;
      let tmpMax = typeof max == "undefined" ? stats.max : max;
      // if (scaleType.startsWith("log") && tmpMin == 0) {
      //   tmpMin = 1;
      // }
      let scale = scales[scaleType]().domain([tmpMin, tmpMax]);
      let ticks = scale.ticks(tickCount);
      let gap = ticks[1] - ticks[0];
      let lastTick = ticks[ticks.length - 1];
      if (typeof min == "undefined") {
        min = 1 * fmt(ticks[0] - gap * Math.ceil((ticks[0] - tmpMin) / gap));
        if ((scaleType.startsWith("log") && min == 0) || isNaN(min)) {
          min = tmpMin;
        }
      }
      max =
        1 *
        fmt(lastTick + gap * Math.max(Math.ceil((tmpMax - lastTick) / gap), 1));
    }
  }
  let domain = [min, max];
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
  return {
    stats,
    domain,
    tickCount,
    cat,
    cats,
    by,
    showOther: definedTerms.other,
  };
};

const scaleBuckets = (buckets, scaleType = "Linear", bounds) => {
  if (scaleType == "date") {
    // let interval = buckets[1] - buckets[0];
    buckets = buckets.map((value) => value);
  } else if (scaleType == "log2") {
    let domain = 2 ** buckets[buckets.length - 1] - 2 ** buckets[0];
    let factor = (bounds.domain[1] - bounds.domain[0]) / domain;
    let scale = (v) => 2 ** v * factor;
    buckets = buckets.map((value) => 1 * fmt(scale(value)));
  } else {
    let scale = scales[scaleType]()
      .domain(bounds.domain)
      .range([buckets[0], buckets[buckets.length - 1]]);
    buckets = buckets.map((value) => 1 * fmt(scale.invert(value)));
  }
  return buckets;
};

const getYValues = ({ obj, yField, typesMap }) => {
  let yBuckets, yValues, yValueType;
  let yHist = obj.yHistograms.by_attribute[yField].histogram;
  yHist.buckets.forEach((yObj, j) => {
    if (j == 0) {
      yBuckets = [];
      yValues = [];
      yValueType = valueTypes[typesMap[yField].type] || "float";
    }
    yBuckets.push(yObj.key);
    yValues.push(yObj.doc_count);
  });
  return { yValues, yBuckets, yValueType };
};

const getHistogram = async ({
  params,
  cat,
  fields,
  rank,
  summaries,
  result,
  exclusions,
  bounds,
  yFields,
  yBounds,
  ySummaries,
  raw,
}) => {
  let typesMap = await attrTypes({ result });
  params.size = raw;
  // find max and min plus most frequent categories
  let field = fields[0];
  let summary = summaries[0];
  let yField;
  let ySummary;
  let rawData;
  let pointData;
  if (yFields && yFields.length > 0) {
    yField = yFields[0];
    ySummary = ySummaries[0];
    fields = [...new Set(fields.concat(yFields))];
  }
  if (cat && typesMap[cat]) {
    fields.push(cat);
  }
  let valueType = valueTypes[typesMap[field].type] || "float";
  params.aggs = await setAggs({
    field,
    summary,
    result,
    histogram: true,
    bounds,
    yField,
    yBounds,
    ySummary,
  });
  let res = await getResults({
    ...params,
    fields,
    exclusions,
    ...(raw && cat && !typesMap[cat] && { ranks: cat }),
  });
  let xSumm, ySumm;
  const dateSummary = {
    min: "from",
    max: "to",
  };
  if (valueType == "date") {
    xSumm = dateSummary[summary] || "value";
  } else {
    xSumm = summary || "value";
  }
  if (yField && yFields) {
    let yValueType = valueTypes[typesMap[yField].type] || "float";
    if (yValueType == "date") {
      ySumm = dateSummary[ySummary] || "value";
    } else {
      ySumm = ySummary || "value";
    }
    if (yFields.length > 0 && raw) {
      pointData = {};
      res.results.forEach((result) => {
        let cat;
        if (bounds.cat) {
          if (bounds.by == "attribute") {
            cat = result.result.fields[bounds.cat].value;
            if (Array.isArray(cat)) {
              cat = cat[0].toLowerCase();
            } else {
              cat = result.result.fields[bounds.cat].value.toLowerCase();
            }
          } else if (result.result.ranks) {
            cat = result.result.ranks[bounds.cat];
            if (cat) {
              cat = cat.taxon_id;
            } else {
              cat = "other";
            }
          }
        }
        if (!pointData[cat]) {
          pointData[cat] = [];
        }
        let x = result.result.fields[field][xSumm];
        let y = result.result.fields[yField][ySumm];
        if (valueType == "date") {
          x = Date.parse(x);
        }
        if (yValueType == "date") {
          y = Date.parse(y);
        }
        pointData[cat].push({
          scientific_name: result.result.scientific_name,
          taxonId: result.result.taxon_id,
          x,
          y,
          cat,
        });
      });
    }
  }

  let hist = res.aggs.aggregations[field].histogram;
  if (!hist) {
    return;
  }
  if (pointData) {
    rawData = {};
  }
  let buckets = [];
  let allValues = [];
  let yBuckets;
  let ranks;
  let allYValues;
  let yValuesByCat;
  let yValueType;
  let zDomain = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let other = [];
  let allOther = [];
  hist.buckets.forEach((obj, i) => {
    buckets.push(obj.key);
    allValues.push(obj.doc_count);

    if (bounds.showOther) {
      other.push(obj.doc_count);
    }
    if (obj.yHistograms) {
      if (i == 0) {
        allYValues = [];
      }
      let yValues;
      ({ yValues, yBuckets, yValueType } = getYValues({
        obj,
        yField,
        typesMap,
      }));
      if (obj.doc_count > 0) {
        let min = Math.min(...yValues);
        let max = Math.max(...yValues);
        zDomain[0] = Math.min(zDomain[0], min);
        zDomain[1] = Math.max(zDomain[1], max);
      }
      allYValues.push(yValues);
      if (bounds.showOther) {
        allOther.push([...yValues]);
      }
    } else {
      if (obj.doc_count > 0) {
        zDomain[0] = Math.min(zDomain[0], obj.doc_count);
        zDomain[1] = Math.max(zDomain[1], obj.doc_count);
      }
    }
  });
  if (typesMap[field].type == "date") {
    buckets = scaleBuckets(buckets, "date", bounds);
  } else {
    buckets = scaleBuckets(buckets, typesMap[field].bins.scale, bounds);
  }

  if (yBuckets) {
    if (typesMap[yField].type == "date") {
      yBuckets = scaleBuckets(yBuckets, "date", yBounds);
    } else {
      yBuckets = scaleBuckets(yBuckets, typesMap[yField].bins.scale, yBounds);
    }
  }
  let catHists = res.aggs.aggregations[field].categoryHistograms;
  let byCat;
  if (catHists) {
    let catBuckets;
    byCat = {};
    if (bounds.by == "attribute") {
      fields.push(bounds.cat);
      catBuckets = catHists.by_attribute.by_cat.buckets;
    } else {
      if (bounds.showOther) {
        byCat.other = other;
        yValuesByCat = { other: allOther };
      }
      ranks = [bounds.cat];
      catBuckets = catHists.by_lineage.at_rank.buckets;
    }
    let catObjs = {};
    bounds.cats.forEach((obj) => {
      catObjs[obj.key] = obj;
    });
    Object.entries(catBuckets).forEach(([key, obj]) => {
      byCat[key] = [];
      catObjs[key].doc_count = 0;
      obj.histogram.by_attribute[field].histogram.buckets.forEach((bin, i) => {
        byCat[key][i] = bin.doc_count;
        catObjs[key].doc_count += bin.doc_count;
        if (byCat.other) {
          byCat.other[i] -= bin.doc_count;
        }
        if (bin.yHistograms) {
          if (i == 0) {
            if (!yValuesByCat) {
              yValuesByCat = {};
            }
            yValuesByCat[key] = [];
          }
          let { yValues } = getYValues({
            obj: bin,
            yField,
            typesMap,
          });
          if (yValuesByCat.other) {
            yValues.forEach((count, j) => {
              yValuesByCat.other[i][j] -= count;
            });
          }

          yValuesByCat[key].push(yValues);
        }
      });
      if (pointData) {
        rawData[key] = pointData[key];
        delete pointData[key];
      }
    });
    if (byCat.other && byCat.other.reduce((a, b) => a + b, 0) == 0) {
      delete byCat.other;
      delete yValuesByCat.other;
    } else if (pointData) {
      rawData.other = Object.values(pointData).flat();
    }
  } else if (pointData) {
    rawData = Object.values(pointData).flat();
  }
  let xLabel, yLabel;
  if (xSumm && xSumm != "value") {
    xLabel = `${summaries[0]}(${field})`;
  } else {
    xLabel = field;
  }
  if (yField) {
    if (ySumm && ySumm != "value") {
      yLabel = `${ySummaries[0]}(${yField})`;
    } else {
      yLabel = yField;
    }
  }

  return {
    buckets,
    allValues,
    byCat,
    rawData,
    valueType,
    yBuckets,
    yValueType,
    allYValues,
    yValuesByCat,
    zDomain,
    params,
    fields,
    ranks,
    xLabel,
    yLabel,
  };
};

export const histogram = async ({
  x,
  y,
  cat,
  result,
  rank,
  includeEstimates,
  queryString,
  xOpts,
  yOpts,
  scatterThreshold,
  report,
  apiParams,
}) => {
  if (!rank) {
    return {
      status: {
        success: false,
        error: `no rank specified`,
      },
    };
  }
  let { params, fields, summaries } = queryParams({ term: x, result, rank });
  let yTerm = combineQueries(x, y);
  let {
    params: yParams,
    fields: yFields,
    summaries: ySummaries,
  } = queryParams({
    term: yTerm,
    result,
    rank,
  });
  let xQuery = { ...params };
  let typesMap = await attrTypes({ result });

  if (!aInB(fields, Object.keys(typesMap))) {
    return {
      status: {
        success: false,
        error: `unknown field in 'x = ${x}'`,
      },
    };
  }
  if (fields.length == 0 || typesMap[fields[0]].type == "keyword") {
    return {
      status: {
        success: false,
        error: `no numeric or date field in '${x ? `x = ${x}` : "x"}'\ntry ${
          x ? "adding ' AND " : "'"
        }assembly_span'`,
      },
    };
  }
  if (yFields && yFields.length > 0) {
    if (!aInB(yFields, Object.keys(typesMap))) {
      return {
        status: {
          success: false,
          error: `unknown field in 'y = ${y}'`,
        },
      };
    }
  }
  if (
    (report == "scatter" && (!y || yFields.length == 0)) ||
    typesMap[yFields[0]].type == "keyword"
  ) {
    return {
      status: {
        success: false,
        error: `no numeric or date field in '${y ? `y = ${y}` : "y"}'\ntry ${
          y ? "adding ' AND " : "'"
        }c_value'`,
      },
    };
  }
  let exclusions;
  if (apiParams.includeEstimates) {
    delete params.excludeAncestral;
    delete xQuery.excludeAncestral;
  } else {
    params.excludeAncestral.push(...yFields);
    if (typesMap[cat]) {
      params.excludeAncestral.push(cat);
    }
  }
  params.excludeMissing.push(...yFields);
  if (typesMap[cat]) {
    params.excludeMissing.push(cat);
  }
  fields = fields.concat(yFields);
  exclusions = setExclusions(params);
  let bounds = await getBounds({
    params: { ...params },
    fields,
    summaries,
    cat,
    result,
    exclusions,
    apiParams,
    opts: xOpts,
  });
  if (!bounds) {
    return {
      status: {
        success: false,
        error:
          "unable to calculate bounds" +
          (rank ? "\ntry a lower taxonomic rank" : ""),
      },
    };
  }
  if (cat && (!bounds.cats || bounds.cats.length == 0)) {
    return {
      status: {
        success: false,
        error: `unknown field in 'cat = ${cat}'`,
      },
    };
  }
  let histograms, yBounds;
  if (yFields && yFields.length > 0) {
    yBounds = await getBounds({
      params: { ...yParams },
      fields: yFields,
      summaries: ySummaries,
      cat,
      result,
      exclusions,
      apiParams,
      opts: yOpts,
    });
  }
  if (bounds && (!bounds.cats || bounds.cats.length > 0)) {
    let threshold = scatterThreshold >= 0 ? scatterThreshold : 10000;
    histograms = await getHistogram({
      params,
      fields,
      rank,
      summaries,
      cat,
      result,
      exclusions,
      bounds,
      yFields,
      yBounds,
      ySummaries,
      raw: bounds.stats.count < threshold ? threshold : 0,
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
  let ranks = [rank].flat();
  if (!typesMap[cat]) {
    ranks.push(cat);
  }

  return {
    status: { success: true },
    report: {
      histograms,
      ...bounds,
      xQuery: {
        ...xQuery,
        fields: fields.join(","),
        ranks,
      },
      x: histograms ? histograms.allValues.reduce((a, b) => a + b, 0) : 0,
    },
    xQuery,
    ...(y && { yQuery: { query: y } }),
    xLabel: histograms ? histograms.xLabel : fields[0],
    yLabel: histograms ? histograms.yLabel : yFields[0],
  };
};
