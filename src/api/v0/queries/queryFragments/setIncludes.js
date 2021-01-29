export const setIncludes = (result, summaryValues) => {
  let include = [];
  if (result == "assembly") {
    include.concat(["assembly_id"]);
  }
  if (result == "taxon" || result == "assembly") {
    include
      .concat([
        "taxon_id",
        "scientific_name",
        "taxon_rank",
        "lineage.*",
        "attributes.key",
        "attributes.aggregation*",
        "attributes.*_value",
        "attributes.*",
      ])
      .concat(
        summaryValues ? summaryValues.map((key) => `attributes.${key}`) : []
      );
  }
  return include;
};
