import { attrTypes } from "../functions/attrTypes";

export const searchByTaxonRawValues = async ({
  searchTerm,
  ancestral,
  fields,
  rank,
  depth,
  includeEstimates,
  includeRawValues,
  filters,
  summaryValues,
  sortBy,
}) => {
  let typesMap = await attrTypes();
  fields.filter((field) => Object.keys(typesMap).includes(field));
  let types = fields.map((field) => typesMap[field]);
  types = [...new Set(types.map((type) => type.type))];
  let aggregation_source = [];
  if (!includeEstimates) {
    aggregation_source = [
      { match: { "attributes.aggregation_source": "direct" } },
      { exists: { field: "attributes.aggregation_method" } },
    ];
  } else {
    aggregation_source = [
      { exists: { field: "attributes.aggregation_source" } },
      { exists: { field: "attributes.aggregation_method" } },
    ];
  }
  let ranks = [];
  if (rank) {
    ranks = [
      {
        match: {
          taxon_rank: rank,
        },
      },
    ];
  }
  let depths = [];
  if (depth) {
    depths = [
      {
        range: {
          "lineage.node_depth": { gte: depth, lte: depth },
        },
      },
    ];
  }
  let lineage = [];
  if (ancestral) {
    lineage = [
      {
        nested: {
          path: "lineage",
          query: {
            bool: {
              filter: [
                {
                  multi_match: {
                    query: searchTerm,
                    fields: ["lineage.taxon_id", "lineage.scientific_name"],
                  },
                },
              ].concat(depths),
            },
          },
        },
      },
    ];
  }
  let sort;
  if (sortBy) {
    sort = [
      {
        [`attributes.${typesMap[sortBy.by].type}_value`]: {
          mode: sortBy.mode || "max",
          order: sortBy.order || "asc",
          nested: {
            path: "attributes",
            filter: {
              term: { "attributes.key": sortBy.by },
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
        ]
          .concat(ranks)
          .concat(
            depths.length > 0
              ? lineage
              : [
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
                ]
          )
          .concat(
            Object.keys(filters).length == 0
              ? []
              : [
                  {
                    nested: {
                      path: "attributes",
                      query: {
                        bool: {
                          filter: [
                            {
                              nested: {
                                path: "attributes.values",
                                query: {
                                  bool: {
                                    filter: [].concat(
                                      Object.keys(filters).map((field) => ({
                                        range: {
                                          [`attributes.values.${typesMap[field].type}_value`]: filters[
                                            field
                                          ],
                                        },
                                      }))
                                    ),
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                ]
          ),
      },
    },
    _source: {
      include: [
        "taxon_id",
        "scientific_name",
        "taxon_rank",
        "attributes.key",
        "attributes.aggregation*",
        "attributes.*_value",
      ].concat(
        summaryValues ? summaryValues.map((key) => `attributes.${key}`) : []
      ),
      exclude: [].concat(includeRawValues ? [] : ["attributes.values.*_value"]),
    },
    sort: [].concat(sort ? sort : []),
  };
};
