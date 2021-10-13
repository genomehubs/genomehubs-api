export const setIncludes = ({
  result,
  summaryValues,
  non_attr_fields,
  includeRawValues,
}) => {
  let include = [];
  if (non_attr_fields && non_attr_fields.length > 0) {
    return non_attr_fields;
  }
  if (result == "assembly") {
    include.concat(["assembly_id"]);
  }
  if (result == "taxon" || result == "assembly") {
    include = include.concat([
      "taxon_id",
      "scientific_name",
      "taxon_rank",
      "parent",
      // "lineage.*",
      // "attributes.key",
      // "attributes.aggregation*",
      // "attributes.*_value",
      // "attributes.*",
    ]);
    // .concat(
    //   summaryValues ? summaryValues.map((key) => `attributes.${key}`) : []
    // );
  }
  if (includeRawValues) {
    include.push("attributes.*");
  }
  return include;
};
