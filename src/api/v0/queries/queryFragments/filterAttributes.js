export const filterAttributes = (
  filters,
  typesMap,
  aggregation_source,
  searchRawValues
) => {
  if (Object.keys(filters).length == 0) {
    return [];
  }
  let rangeQuery;
  if (searchRawValues) {
    rangeQuery = (field) => {
      return {
        nested: {
          path: "attributes.values",
          query: {
            range: {
              [`attributes.values.${typesMap[field].type}_value`]:
                filters[field],
            },
          },
        },
      };
    };
  } else {
    rangeQuery = (field) => {
      let stat = `${typesMap[field].type}_value`;
      let filter = { ...filters[field] };
      if (filter.stat) {
        stat = filter.stat;
        delete filter.stat;
      }
      return {
        range: {
          [`attributes.${stat}`]: filter,
        },
      };
    };
  }

  return Object.keys(filters).length == 0
    ? []
    : Object.keys(filters).map((field) => ({
        nested: {
          path: "attributes",
          query: {
            bool: {
              filter: [
                { match: { "attributes.key": field } },
                rangeQuery(field),
              ].concat(aggregation_source),
            },
          },
        },
      }));
};
