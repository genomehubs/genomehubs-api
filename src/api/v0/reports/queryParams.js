export const queryParams = ({
  term,
  result,
  rank,
  includeEstimates = false,
}) => {
  let params = {
    result,
    query: term,
    includeEstimates,
  };
  let fields = [];
  if (rank) {
    if (params.query) {
      params.query += ` AND tax_rank(${rank})`;
      let field = term.replace(/[^\w_\(\)].+$/, "");
      if (field.match(/\(/)) {
        field = field.split(/[\(\)]/)[1];
      }
      params.includeEstimates = true;
      params.excludeAncestral = [field];
      params.excludeMissing = [field];
      fields.push(field);
    } else {
      params.includeEstimates = true;
      params.query = `tax_rank(${rank})`;
    }
  }
  return { params, fields };
};
