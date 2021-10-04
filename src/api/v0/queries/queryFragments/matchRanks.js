export const matchRanks = (ranks = {}) => {
  console.log(ranks);
  ranks = Object.keys(ranks);
  if (ranks.length == 0) return [];
  return [
    {
      bool: {
        should: [
          {
            nested: {
              path: "lineage",
              query: {
                bool: {
                  should: ranks.map((rank) => ({
                    bool: {
                      filter: { match: { "lineage.taxon_rank": rank } },
                    },
                  })),
                },
              },
              inner_hits: {
                _source: false,
                docvalue_fields: [
                  "lineage.taxon_id",
                  "lineage.taxon_rank",
                  "lineage.node_depth",
                  "lineage.scientific_name.raw",
                  "lineage.support_value",
                ],
                size: 100,
              },
            },
          },
          { match_all: {} },
        ],
      },
    },
  ];
};
