import { attrTypes } from "../functions/attrTypes";

const scales = {
  log2: "Math.log(_value)/Math.log(2)",
  log10: "Math.log10(_value)",
  sqrt: "Math.sqrt(_value)",
};

const histogramAgg = async (field, result) => {
  let typesMap = await attrTypes({ result });
  if (!typesMap[field]) {
    return;
  }
  let { scale, min, max, count } = typesMap[field].bins;
  let interval;
  if (count) {
    interval = (max - min) / count;
  }
  return {
    histogram: {
      field: `attributes.values.${typesMap[field].type}_value`,
      ...(scales[scale] && { script: scales[scale] }),
      ...(interval && { interval }),
      extended_bounds: {
        min,
        max,
      },
    },
  };
};

const termsAgg = async (field, result) => {
  let typesMap = await attrTypes({ result });
  if (!typesMap[field]) {
    return;
  }
  return {
    terms: {
      field: `attributes.values.${typesMap[field].type}_value`,
    },
  };
};

export const aggregateRawValuesByTaxon = async ({
  lineage,
  field,
  result,
  summary,
}) => {
  let histogram, terms;
  let typesMap = await attrTypes({ result });
  if (summary == "histogram") {
    histogram = await histogramAgg(field, result);
  }
  if (summary == "terms") {
    terms = await termsAgg(field, result);
  }
  return {
    size: 0,
    query: {
      bool: {
        should: [
          {
            match: { taxon_id: lineage },
          },
          {
            nested: {
              path: "lineage",
              query: {
                match: { "lineage.taxon_id": lineage },
              },
            },
          },
        ],
      },
    },
    aggs: {
      attributes: {
        nested: {
          path: "attributes",
        },
        aggs: {
          [field]: {
            filter: {
              bool: {
                filter: [
                  {
                    term: { "attributes.key": field },
                  },
                  {
                    term: { "attributes.aggregation_source": "direct" },
                  },
                ],
              },
            },
            aggs: {
              summary: {
                nested: {
                  path: "attributes.values",
                },
                aggs: {
                  histogram,
                  terms,
                },
              },
            },
          },
        },
      },
    },
  };
};
