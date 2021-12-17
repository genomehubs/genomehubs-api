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
  let parts = [result];
  if (taxonomy === undefined || taxonomy == "undefined") {
    console.log({ taxonomy });
    taxonomy = config.taxonomy;
  }
  if (taxonomy) parts.push(taxonomy);
  if (!hub) hub = config.hub;
  parts.push(hub);
  if (!release || release == "latest") release = config.release;
  parts.push(release);
  let sep = config.separator;
  console.log(`!${parts.join(sep)}`);
  return `${parts.join(sep)}`;
};
