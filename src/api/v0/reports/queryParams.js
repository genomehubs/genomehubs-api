export const queryParams = ({
  term,
  result,
  rank,
  taxonomy,
  includeEstimates = false,
}) => {
  let params = {
    result,
    query: term,
    taxonomy,
    includeEstimates,
  };
  let fields = [];
  if (rank) {
    if (params.query) {
      params.query += ` AND tax_rank(${rank})`;
      params.includeEstimates = true;
      params.excludeAncestral = [];
      params.excludeMissing = [];

      term.split(/\s+(?:and|AND)\s+/).forEach((subterm) => {
        if (!subterm.match("tax_")) {
          let field = subterm.replace(/[^\w_\(\)].+$/, "");
          if (field.match(/\(/)) {
            field = field.split(/[\(\)]/)[1];
          }
          params.excludeAncestral.push(field);
          params.excludeMissing.push(field);
          fields.push(field);
        }
      });
    } else {
      params.includeEstimates = true;
      params.query = `tax_rank(${rank})`;
    }
  }
  return { params, fields };
};
