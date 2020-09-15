import { config } from "./config";

export const indexName = ({ result, taxonomy, hub, release }) => {
  if (!hub) hub = config.hub;
  if (!taxonomy) taxonomy = config.taxonomy;
  if (!release || release == "latest") release = config.release;
  let sep = config.separator;
  if (result == "taxon" || result == "assembly") {
    return `${result}${sep}${taxonomy}${sep}${hub}${sep}${release}`;
  }
  return `${result}${sep}${hub}${sep}${release}`;
};
