import { attrTypes } from "../functions/attrTypes";
import { histogramAgg } from "../queries/histogramAgg";

const attributeTerms = ({ terms, size }) => {
  let attribute = terms;
  return {
    reverse_nested: {},
    aggs: {
      by_attribute: {
        nested: {
          path: "attributes",
        },
        aggs: {
          by_cat: {
            filter: {
              term: { "attributes.key": attribute },
            },
            aggs: {
              cats: { terms: { field: "attributes.keyword_value", size } },
            },
          },
        },
      },
    },
  };
};

const attributeCategory = ({ cats, field, histogram }) => {
  let filters = {};
  cats.forEach((obj, i) => {
    filters[obj.key] = { term: { "attributes.keyword_value": obj.key } };
  });
  return {
    reverse_nested: {},
    aggs: {
      by_attribute: {
        nested: {
          path: "attributes",
        },
        aggs: {
          by_cat: {
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
};

const nestedHistograms = ({ field, histogram }) => {
  return {
    reverse_nested: {},
    aggs: {
      by_attribute: {
        nested: {
          path: "attributes",
        },
        // aggs: {
        //   by_cat: {
        //     filters: {
        //       filters,
        //     },
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
        //   },
        // },
      },
    },
  };
};

const lineageTerms = ({ terms, size }) => {
  let rank = terms;
  return {
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
};

const lineageCategory = ({ cats, field, histogram }) => {
  let filters = {};
  cats.forEach((obj, i) => {
    filters[obj.key] = { term: { "lineage.taxon_id": obj.key } };
  });
  return {
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
};

export const setAggs = async ({
  field,
  result,
  histogram,
  stats,
  terms,
  size = 5,
  bounds,
  yField,
  yBounds,
}) => {
  let typesMap = await attrTypes({ result });
  if (!typesMap[field]) {
    return;
  }
  let yHistogram, yHistograms;
  if (histogram && yField) {
    yHistogram = await histogramAgg({ field: yField, result, bounds: yBounds });
    yHistograms = nestedHistograms({
      field: yField,
      histogram: yHistogram,
    });
  }
  if (histogram) {
    histogram = await histogramAgg({ field, result, bounds, yHistograms });
  }
  let categoryHistograms;
  if (bounds && bounds.cats) {
    if (bounds.by == "attribute") {
      categoryHistograms = attributeCategory({
        cats: bounds.cats,
        field,
        histogram,
      });
    } else {
      categoryHistograms = lineageCategory({
        cats: bounds.cats,
        field,
        histogram,
      });
    }
  }
  if (stats) {
    stats = {
      stats: {
        field: `attributes.${typesMap[field].type}_value`,
      },
    };
  }
  if (terms) {
    if (typesMap[terms]) {
      if (typesMap[terms].type == "keyword") {
        terms = attributeTerms({ terms, size });
      }
    } else {
      terms = lineageTerms({ terms, size });
    }
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
            yHistograms,
          },
        },
      },
    },
  };
};
