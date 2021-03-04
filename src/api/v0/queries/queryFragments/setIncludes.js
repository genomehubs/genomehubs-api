export const setIncludes = (result, summaryValues, non_attr_fields) => {
  let include = [];
  if (non_attr_fields) {
    return non_attr_fields;
  }
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
