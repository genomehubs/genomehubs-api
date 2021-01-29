export const matchAttributes = (fields, typesMap, aggregation_source) => {
  if (fields.length == 0) return [];
  return [
    {
      nested: {
        path: "attributes",
        query: {
          bool: {
            should: fields.map((field) => ({
              bool: {
                filter: [
                  { match: { "attributes.key": field } },
                  {
                    exists: {
                      field: `attributes.${typesMap[field].type}_value`,
                    },
                  },
                ].concat(aggregation_source),
              },
            })),
          },
        },
      },
    },
  ];
};
