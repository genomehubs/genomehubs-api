import { config } from "./config";

export const indexName = ({ result, taxonomy, hub, version }) => {
  if (!hub) hub = config.hub;
  if (!taxonomy) taxonomy = config.taxonomy;
  if (!version || version == "latest") version = config.version;
  let sep = config.separator;
  if (result == "taxon" || result == "assembly") {
    return `${result}${sep}${taxonomy}${sep}${hub}${sep}${version}`;
  }
  return `${result}${sep}${hub}${sep}${version}`;
};
