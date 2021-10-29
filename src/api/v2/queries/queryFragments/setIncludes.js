export const setIncludes = ({
  result,
  summaryValues,
  non_attr_fields,
  includeRawValues,
}) => {
  let include = [];
  // console.log(non_attr_fields);
  if (non_attr_fields && non_attr_fields.length > 0) {
    return non_attr_fields;
    // include = ["lineage"];
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
    if (result == "assembly") {
      include.push("assembly_id");
    }
  }

  if (includeRawValues) {
    include.push("attributes.*");
  }
  return include;
};
