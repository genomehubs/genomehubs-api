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
            let filter, must_not;
            let taxonId = [];
            if (term.match(":")) {
              let source;
              [source, term] = term.split(":");
              filter = [
                {
                  wildcard: {
                    "taxon_names.name": term,
                  },
                },
              ];
              if (term && term > "*") {
                filter.push({
                  wildcard: {
                    "taxon_names.source": source,
                  },
                });
              } else {
                filter = {
                  wildcard: {
                    "taxon_names.source": source,
                  },
                };
              }
            } else {
              taxonId = [{ taxon_id: term }];
              must_not = {
                exists: {
                  field: "taxon_names.source",
                },
              };
            }
            if (term.match(/\*/)) {
              return {
                bool: {
                  should: [
                    {
                      nested: {
                        path: "taxon_names",
                        query: {
                          bool: {
                            filter,
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
