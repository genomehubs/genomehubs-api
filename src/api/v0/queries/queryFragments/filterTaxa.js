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
                          wildcard: {
                            "taxon_names.name": term,
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
                        match: {
                          "taxon_names.name": term,
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
                  match: {
                    "taxon_names.name": searchTerm,
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
