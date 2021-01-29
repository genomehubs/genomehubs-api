export const limitDepth = (depth) => {
  if (depth) {
    return [
      {
        range: {
          "lineage.node_depth": { gte: depth, lte: depth },
        },
      },
    ];
  }
  return [];
};
