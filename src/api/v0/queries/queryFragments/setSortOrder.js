export const setSortOrder = (sortBy, typesMap) => {
  if (sortBy) {
    if (sortBy.by == "scientific_name" || sortBy.by == "taxon_id") {
      return [
        {
          [sortBy.by]: {
            mode: sortBy.mode || "max",
            order: sortBy.order || "asc",
          },
        },
      ];
    } else {
      return [
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
  return [];
};
