const termsAgg = async () => {
  return {
    terms: {
      field: "attributes.values.source",
    },
  };
};

export const aggregateRawValueSources = async ({}) => {
  let terms = await termsAgg();
  return {
    size: 0,
    query: {
      match_all: {},
    },
    aggs: {
      attributes: {
        nested: {
          path: "attributes",
        },
        aggs: {
          summary: {
            nested: {
              path: "attributes.values",
            },
            aggs: {
              terms,
            },
          },
        },
      },
    },
  };
};
