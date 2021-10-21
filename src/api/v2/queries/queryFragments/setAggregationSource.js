export const setAggregationSource = (result, includeEstimates) => {
  let aggregation_source = [];
  if (result == "taxon") {
    if (!includeEstimates) {
      aggregation_source = [
        { match: { "attributes.aggregation_source": "direct" } },
        { exists: { field: "attributes.aggregation_method" } },
      ];
    } else if (includeEstimates !== true) {
      aggregation_source = [
        { match: { "attributes.aggregation_source": includeEstimates } },
        { exists: { field: "attributes.aggregation_method" } },
      ];
    } else {
      aggregation_source = [
        { exists: { field: "attributes.aggregation_source" } },
        { exists: { field: "attributes.aggregation_method" } },
      ];
    }
  }
  return aggregation_source;
};
