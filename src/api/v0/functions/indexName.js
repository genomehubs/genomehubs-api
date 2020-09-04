export const indexName = ({ result, taxonomy, hub, version }) => {
  if (result == "taxon" || result == "assembly") {
    return `${result}--${taxonomy}--${hub}--${version}`;
  }
  return `${result}--${hub}--${version}`;
};
