export const excludeSources = (exclusions = {}, fields) => {
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
  return excluded;
};
