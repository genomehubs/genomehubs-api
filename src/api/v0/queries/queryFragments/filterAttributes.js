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
    rangeQuery = (field) => ({
      nested: {
        path: "attributes.values",
        query: {
          range: {
            [`attributes.values.${typesMap[field].type}_value`]: filters[field],
          },
        },
      },
    });
  } else {
    rangeQuery = (field) => ({
      range: {
        [`attributes.${typesMap[field].type}_value`]: filters[field],
      },
    });
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
