export const matchAttributes = (
  fields,
  typesMap,
  aggregation_source,
  searchRawValues
) => {
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
        inner_hits: {
          _source: false,
          docvalue_fields: [
            "attributes.key",
            "attributes.is_primary_value",
            "attributes.count",
            "attributes.aggregation_method",
            "attributes.aggregation_source",
            "attributes.aggregation_rank",
            "attributes.aggregation_taxon_id",
            "attributes.keyword_value.raw",
            "attributes.date_value",
            "attributes.long_value",
            "attributes.integer_value",
            "attributes.short_value",
            "attributes.byte_value",
            "attributes.double_value",
            "attributes.float_value",
            "attributes.half_float_value",
            "attributes.*dp_value",
          ].concat(searchRawValues ? ["attributes.values.*"] : []),
          size: 100,
        },
      },
    },
  ];
};
