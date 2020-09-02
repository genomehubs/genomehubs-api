import formatJson from "../functions/formatJson";
import client from "../functions/connection";
import checkResponse from "../functions/checkResponse";
import processHits from "../functions/processHits";

const sayt = async (params) => {
  const { body } = await client
    .searchTemplate({
      index: `${params.result}-*`,
      body: { id: `${params.result}_sayt`, params },
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      return err.meta;
    });
  let results = [];
  let status = checkResponse({ body });
  if (status.hits) {
    results = processHits({ body, reason: false });
  }
  return { status, results };
};

const lookup = async (params) => {
  let id = `${params.result}_lookup`;
  if (params.lineage) {
    id = `${id}_by_lineage`;
  }
  const { body } = await client
    .searchTemplate({
      index: `${params.result}-*`,
      body: { id, params },
      rest_total_hits_as_int: true,
    })
    .catch((err) => {
      return err.meta;
    });
  let results = [];
  let status = checkResponse({ body });
  if (status.hits) {
    results = processHits({ body, reason: true });
  }
  return { status, results };
};

const suggest = async (params) => {
  const { body } = await client
    .searchTemplate({
      index: `${params.result}-*`,
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
    if (req.query.prefixQuery) {
      response = await sayt(req.query);
    } else {
      if (req.query.size) {
        response = await lookup(req.query);
      }
      if (!response.status.success || response.status.hits == 0) {
        if (req.query.suggestSize) {
          response = await suggest(req.query);
        }
      }
    }
    return res.status(200).send(formatJson(response, req.query.indent));
  },
};
