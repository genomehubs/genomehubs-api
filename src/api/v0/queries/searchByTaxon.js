import { attrTypes } from "../functions/attrTypes";
import { excludeSources } from "./queryFragments/excludeSources";
import { filterAssemblies } from "./queryFragments/filterAssemblies";
import { filterAttributes } from "./queryFragments/filterAttributes";
import { filterTaxa } from "./queryFragments/filterTaxa";
import { matchAttributes } from "./queryFragments/matchAttributes";
import { restrictToRank } from "./queryFragments/restrictToRank";
import { setAggregationSource } from "./queryFragments/setAggregationSource";
import { setIncludes } from "./queryFragments/setIncludes";
import { setSortOrder } from "./queryFragments/setSortOrder";

export const searchByTaxon = async ({
  searchTerm,
  idTerm,
  multiTerm,
  result,
  ancestral,
  fields,
  rank,
  depth,
  includeEstimates,
  includeRawValues,
  searchRawValues,
  filters,
  exclusions,
  summaryValues,
  size,
  offset,
  sortBy,
}) => {
  let typesMap = await attrTypes({ result });
  fields = fields.filter((field) => typesMap[field] !== undefined);
  let types = fields.map((field) => typesMap[field]);
  types = [...new Set(types.map((type) => type.type))];

  let aggregation_source = setAggregationSource(result, includeEstimates);
  let excludedSources = excludeSources(exclusions, fields);
  let attributesExist = matchAttributes(fields, typesMap, aggregation_source);
  let attributeValues = filterAttributes(
    filters,
    typesMap,
    aggregation_source,
    searchRawValues
  );
  let taxonFilter = filterTaxa(depth, searchTerm, multiTerm, ancestral);
  let assemblyFilter = [];
  if (result == "assembly") {
    assemblyFilter = filterAssemblies(searchTerm, multiTerm, idTerm);
  }
  let rankRestriction = restrictToRank(rank);
  let include = setIncludes(result, summaryValues);
  let exclude = includeRawValues ? [] : ["attributes.values*"];
  let sort = setSortOrder(sortBy, typesMap);

  return {
    size,
    from: offset,
    query: {
      bool: {
        must_not: excludedSources,
        filter: attributesExist
          .concat(attributeValues)
          .concat(taxonFilter)
          .concat(rankRestriction)
          .concat(assemblyFilter),
      },
    },
    _source: {
      include,
      exclude,
    },
    sort,
  };
};
