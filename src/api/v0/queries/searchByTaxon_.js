import { attrTypes } from "../functions/typesMap";

export const searchByTaxon = ({ searchTerm, fields, result="taxon" }) => {
  let typesMap = await attrTypes({result})
  let types = fields.map((field) => typesMap[field]);
  types = [...new Set(types)];
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
              ],
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
                      ],
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
