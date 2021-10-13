export const excludeSources = (exclusions = {}, fields) => {
  let excluded = [];
  Object.keys(exclusions).forEach((source) => {
    if (source == "unclassified") {
      // excluded.push({ prefix: { scientific_name: { value: "unclassified" } } });
      // excluded.push({
      //   prefix: { scientific_name: { value: "environmental" } },
      // });
      excluded.push({
        nested: {
          path: "lineage",
          query: {
            prefix: { "lineage.scientific_name": { value: "unclassified" } },
          },
        },
      });
      excluded.push({
        nested: {
          path: "lineage",
          query: {
            prefix: { "lineage.scientific_name": { value: "environmental" } },
          },
        },
      });

      // excluded.push({
      //   bool: {
      //     must_not: [
      //       { prefix: { scientific_name: { value: "unclassified" } } },
      //       { prefix: { scientific_name: { value: "environmental" } } },
      //     ],
      //   },
      // });
      return;
    }

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
  return excluded;
};
