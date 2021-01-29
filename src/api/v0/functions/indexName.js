import { config } from "./config";

export const indexName = ({ result, taxonomy, hub, release }) => {
  /**
   * Generate an index name based on indexInfo.
   * @param {Object} indexInfo Information about the record.
   * @param {string} indexInfo.result - The index type.
   * @param {string} indexInfo.taxonomy - Backbone taxonomy name.
   * @param {string} indexInfo.hub - Hub name.
   * @param {string} indexInfo.release - Hub release version.
   */
  if (!hub) hub = config.hub;
  if (!taxonomy) taxonomy = config.taxonomy;
  if (!release || release == "latest") release = config.release;
  let sep = config.separator;
  // if (result == "taxon" || result == "assembly") {
  return `${result}${sep}${taxonomy}${sep}${hub}${sep}${release}`;
  // }
  // return `${result}${sep}${hub}${sep}${release}`;
};
