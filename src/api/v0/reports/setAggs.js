import { attrTypes } from "../functions/attrTypes";
import { histogramAgg } from "../queries/histogramAgg";

export const setAggs = async ({
  field,
  result,
  histogram,
  stats,
  terms,
  size = 5,
  bounds,
}) => {
  let typesMap = await attrTypes({ result });
  if (!typesMap[field]) {
    return;
  }
  if (histogram) {
    histogram = await histogramAgg({ field, result, bounds });
  }
  let categoryHistograms;
  if (bounds && bounds.cats) {
    let filters = {};
    bounds.cats.forEach((obj, i) => {
      filters[obj.key] = { term: { "lineage.taxon_id": obj.key } };
    });
    categoryHistograms = {
      reverse_nested: {},
      aggs: {
        by_lineage: {
          nested: {
            path: "lineage",
          },
          aggs: {
            at_rank: {
              filters: {
                filters,
              },
              aggs: {
                histogram: {
                  reverse_nested: {},
                  aggs: {
                    by_attribute: {
                      nested: {
                        path: "attributes",
                      },
                      aggs: {
                        [field]: {
                          filter: {
                            term: { "attributes.key": field },
                          },
                          aggs: {
                            histogram,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }
  if (stats) {
    stats = {
      stats: {
        field: `attributes.${typesMap[field].type}_value`,
      },
    };
  }
  if (terms) {
    let rank = terms;
    terms = {
      reverse_nested: {},
      aggs: {
        by_lineage: {
          nested: {
            path: "lineage",
          },
          aggs: {
            at_rank: {
              filter: {
                term: { "lineage.taxon_rank": rank },
              },
              aggs: {
                taxa: { terms: { field: "lineage.taxon_id", size } },
              },
            },
          },
        },
      },
    };
  }

  return {
    aggregations: {
      nested: {
        path: "attributes",
      },
      aggs: {
        [field]: {
          filter: {
            term: { "attributes.key": field },
          },
          aggs: {
            histogram,
            stats,
            terms,
            categoryHistograms,
          },
        },
      },
    },
  };
};
