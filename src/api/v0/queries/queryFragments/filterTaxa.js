import { limitDepth } from "./limitDepth";
import { searchInLineage } from "./searchInLineage";

export const filterTaxa = (depth, searchTerm, multiTerm, ancestral) => {
  let depths = limitDepth(depth);
  let lineage = searchInLineage(searchTerm, ancestral, depths);
  if (depths.length > 0) {
    return lineage;
  }
  if (multiTerm && multiTerm > "") {
    lineage = [];
  } else if (searchTerm && searchTerm > "") {
    multiTerm = [searchTerm];
  }
  if (multiTerm && multiTerm > "") {
    return [
      {
        bool: {
          should: multiTerm.map((term) => {
            let filter, should, must_not;
            let taxonId = [];
            let source;

            if (term.match(":")) {
              [source, term] = term.split(":");
              should = [
                {
                  match: {
                    "taxon_names.source": source,
                  },
                },
                {
                  match: {
                    "taxon_names.class": source,
                  },
                },
              ];
            } else {
              must_not = {
                exists: {
                  field: "taxon_names.source",
                },
              };
            }
            if (term && term > "*") {
              if (term.match(/\*/)) {
                filter = [
                  {
                    wildcard: {
                      "taxon_names.name": term,
                    },
                  },
                ];
              } else {
                filter = [
                  {
                    match: {
                      "taxon_names.name": term,
                    },
                  },
                ];
                taxonId = [
                  {
                    match: {
                      taxon_id: term,
                    },
                  },
                ];
              }
            }
            if (filter && should) {
              filter.push({ bool: { should } });
            } else if (should) {
              filter = { bool: { should } };
            }

            // if (term.match(/\*/)) {
            return {
              bool: {
                should: [
                  {
                    nested: {
                      path: "taxon_names",
                      query: {
                        bool: {
                          filter,
                          // should,
                          must_not,
                        },
                      },
                    },
                  },
                ]
                  .concat(taxonId)
                  .concat(lineage),
              },
            };
            // }
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
                ].concat(lineage),
              },
            };
          }),
        },
      },
    ];
  }
  // if (searchTerm && searchTerm > "") {
  //   return [
  //     {
  //       bool: {
  //         should: [
  //           {
  //             match: { taxon_id: searchTerm },
  //           },
  //           {
  //             nested: {
  //               path: "taxon_names",
  //               query: {
  //                 bool: {
  //                   filter: {
  //                     term: {
  //                       "taxon_names.name": searchTerm,
  //                     },
  //                   },
  //                   must_not: {
  //                     exists: {
  //                       field: "taxon_names.source",
  //                     },
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         ].concat(lineage),
  //       },
  //     },
  //   ];
  // }
  return [];
};
