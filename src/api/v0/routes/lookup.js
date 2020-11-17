import { checkResponse } from "../functions/checkResponse";
import { formatJson } from "../functions/formatJson";
import { client } from "../functions/connection";
import { indexName } from "../functions/indexName";
import { processHits } from "../functions/processHits";

const sayt = async (params, iter = 0) => {
  let result = params.result;
  if (result == "multi") {
    result = iter == 0 ? "taxon" : "assembly";
  }
  let newParams = { ...params, result };
  let index = indexName(newParams);
  const { body } = await client
    .searchTemplate({
      index,
      body: { id: `${result}_sayt`, params: newParams },
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      return err.meta;
    });
  let results = [];
  let status = checkResponse({ body });
  status.result = result;
  if (status.hits && status.hits > 0) {
    results = processHits({ body, reason: true });
  } else if (iter < 1 && params.result == "multi") {
    let updated = await sayt(params, (iter = 1));
    status = updated.status;
    results = updated.results;
  }
  return { status, results };
};

const lookup = async (params, iter = 0) => {
  let result = params.result;
  if (result == "multi") {
    result = iter == 0 ? "taxon" : "assembly";
  }
  let newParams = { ...params, result };
  let index = indexName(newParams);
  let id = `${params.result}_lookup`;
  if (params.lineage) {
    id = `${id}_by_lineage`;
  }
  const { body } = await client
    .searchTemplate({
      index,
      body: { id, params: newParams },
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      return err.meta;
    });
  let results = [];
  let status = checkResponse({ body });
  status.result = result;
  if (status.hits && status.hits > 0) {
    results = processHits({ body, reason: true });
  } else if (iter < 1 && params.result == "multi") {
    let updated = await sayt(params, (iter = 1));
    status = updated.status;
    results = updated.results;
  }
  return { status, results };
};

const suggest = async (params) => {
  let index = indexName({ ...params });
  const { body } = await client
    .searchTemplate({
      index,
      body: { id: `${params.result}_suggest`, params },
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      return err.meta;
    });
  let suggestions = [];
  let status = checkResponse({ body });
  if (status.success) {
    body.suggest.simple_phrase.forEach((suggestion) => {
      suggestion.options.forEach((option) => {
        if (option.collate_match) {
          suggestions.push({
            text: suggestion.text,
            suggestion: { ...option },
          });
        }
      });
    });
  }
  return { status, suggestions };
};

module.exports = {
  getIdentifiers: async (req, res) => {
    let response = {};
    response = await sayt(req.query);
    if (
      !response.status ||
      !response.status.success ||
      response.status.hits == 0
    ) {
      response = await lookup(req.query);
    }
    if (
      !response.status ||
      !response.status.success ||
      response.status.hits == 0
    ) {
      response = await suggest(req.query);
    }
    return res.status(200).send(formatJson(response, req.query.indent));
  },
};
