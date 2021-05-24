import { limitDepth } from "./limitDepth";
import { searchInLineage } from "./searchInLineage";

export const filterTaxa = (depth, searchTerm, multiTerm, ancestral) => {
  let depths = limitDepth(depth);
  let lineage = searchInLineage(searchTerm, ancestral, depths);
  if (depths.length > 0) {
    return lineage;
  }
  if (multiTerm && multiTerm > "") {
    return [
      {
        bool: {
          should: multiTerm.map((term) => {
            if (term.match(/\*/)) {
              return {
                bool: {
                  should: [
                    {
                      wildcard: { taxon_id: term },
                    },
                    {
                      nested: {
                        path: "taxon_names",
                        query: {
                          bool: {
                            filter: {
                              wildcard: {
                                "taxon_names.name": term,
                              },
                            },
                          },
                          must_not: {
                            exists: {
                              field: "taxon_names.source",
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              };
            }
            return {
              bool: {
                should: [
                  {
                    match: { taxon_id: term },
                  },
                  {
                    nested: {
                      path: "taxon_names",
                      query: {
                        bool: {
                          filter: {
                            term: {
                              "taxon_names.name": term,
                            },
                          },
                          must_not: {
                            exists: {
                              field: "taxon_names.source",
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            };
          }),
        },
      },
    ];
  }
  if (searchTerm && searchTerm > "") {
    return [
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
                  bool: {
                    filter: {
                      term: {
                        "taxon_names.name": searchTerm,
                      },
                    },
                    must_not: {
                      exists: {
                        field: "taxon_names.source",
                      },
                    },
                  },
                },
              },
            },
          ].concat(lineage),
        },
      },
    ];
  }
  return [];
};
