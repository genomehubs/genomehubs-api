import { attrTypes } from "../functions/attrTypes";

export const searchByTaxon = async ({
  searchTerm,
  result,
  ancestral,
  fields,
  rank,
  depth,
  includeEstimates,
  includeRawValues,
  filters,
  exclusions,
  summaryValues,
  size,
  offset,
  sortBy,
}) => {
  let typesMap = await attrTypes();
  fields.filter((field) => Object.keys(typesMap).includes(field));
  let types = fields.map((field) => typesMap[field]);
  types = [...new Set(types.map((type) => type.type))];
  let aggregation_source = [];
  if (result == "taxon" && !includeEstimates) {
    aggregation_source = [
      { match: { "attributes.aggregation_source": "direct" } },
      { exists: { field: "attributes.aggregation_method" } },
    ];
  } else if (result == "taxon") {
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
  let excluded = [];
  Object.keys(exclusions).forEach((source) => {
    exclusions[source].forEach((field) => {
      excluded.push({
        nested: {
          path: "attributes",
          query: {
            bool: {
              filter: [
                {
                  match: { "attributes.key": field },
                },
                {
                  match: {
                    "attributes.aggregation_source": source,
                  },
                },
              ],
            },
          },
        },
      });
    });
  });
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
    if (sortBy.by == "scientific_name" || sortBy.by == "taxon_id") {
      sort = [
        {
          [sortBy.by]: {
            mode: sortBy.mode || "max",
            order: sortBy.order || "asc",
          },
        },
      ];
    } else {
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
  }
  return {
    size,
    from: offset,
    query: {
      bool: {
        must_not: excluded,
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
              : Object.keys(filters).map((field) => ({
                  nested: {
                    path: "attributes",
                    query: {
                      bool: {
                        filter: [
                          { match: { "attributes.key": field } },
                          {
                            range: {
                              [`attributes.${typesMap[field].type}_value`]: filters[
                                field
                              ],
                            },
                          },
                        ].concat(aggregation_source),
                      },
                    },
                  },
                }))
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
        "attributes.*",
      ].concat(
        summaryValues ? summaryValues.map((key) => `attributes.${key}`) : []
      ),
      exclude: [].concat(includeRawValues ? [] : ["attributes.values*"]),
    },
    sort: [].concat(sort ? sort : []),
  };
};
