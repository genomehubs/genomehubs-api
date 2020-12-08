import { attrTypes } from "../functions/attrTypes";

export const searchByNameList = async ({
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
  let typesMap = await attrTypes({ result });
  fields = fields.filter((field) => typesMap[field] !== undefined);
  let types = fields.map((field) => typesMap[field]);
  types = [...new Set(types.map((type) => type.type))];
  let excluded = [];
  Object.keys(exclusions).forEach((source) => {
    exclusions[source].forEach((field) => {
      if (source == "missing") {
        delete fields[field];
        excluded.push({
          bool: {
            must_not: {
              nested: {
                path: "attributes",
                query: {
                  match: { "attributes.key": field },
                },
              },
            },
          },
        });
        return;
      }
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
                      ],
                    },
                  })),
                },
              },
            },
          },
          {
            bool: {
              should: searchTerm.map((term) => ({
                bool: {
                  should: [
                    {
                      match: { taxon_id: term },
                    },
                    {
                      nested: {
                        path: "taxon_names",
                        query: {
                          match: {
                            "taxon_names.name": term,
                          },
                        },
                      },
                    },
                  ],
                },
              })),
            },
          },
        ].concat(
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
        "lineage.*",
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
