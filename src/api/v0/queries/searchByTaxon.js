import { typesMap } from "../functions/typesMap";

export const searchByTaxon = ({
  searchTerm,
  ancestral,
  fields,
  includeEstimates,
  rawValues,
}) => {
  let types = fields.map((field) => typesMap[field]);
  types = [...new Set(types)];
  let aggregation_source = [];
  if (!includeEstimates) {
    aggregation_source = [
      { match: { "attributes.aggregation_source": "direct" } },
    ];
  }
  let lineage = [];
  if (ancestral) {
    lineage = [
      {
        nested: {
          path: "lineage",
          query: {
            multi_match: {
              query: searchTerm,
              fields: ["lineage.taxon_id", "lineage.scientific_name"],
            },
          },
        },
      },
    ];
  }
  return {
    query: {
      bool: {
        filter: [
          {
            bool: {
              should: [
                {
                  match: { taxon_id: searchTerm },
                },
                {
                  nested: {
                    path: "taxon_names",
                    query: {
                      match: {
                        "taxon_names.name.raw": searchTerm,
                      },
                    },
                  },
                },
              ].concat(lineage),
            },
          },
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
                            field: `attributes.${typesMap[field]}_value`,
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
                  {
                    field: "attributes.key",
                    format: "use_field_mapping",
                  },
                ].concat(
                  types.map((type) => ({
                    field: `attributes.${type}_value`,
                    format: "use_field_mapping",
                  }))
                ),
              },
            },
          },
        ],
      },
    },
    _source: {
      include: ["taxon_id", "scientific_name", "rank"],
    },
  };
};
