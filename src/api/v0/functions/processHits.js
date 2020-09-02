const processHits = ({ body, reason }) => {
  let results = [];
  body.hits.hits.forEach((hit) => {
    let result = {
      index: hit._index,
      id: hit._id,
      score: hit._score,
      result: hit._source,
    };
    if (reason && hit.inner_hits) {
      let reason = [];
      Object.keys(hit.inner_hits).forEach((key) => {
        hit.inner_hits[key].hits.hits.forEach((inner_hit) => {
          reason.push({ score: inner_hit._score, fields: inner_hit.fields });
        });
      });
      if (reason.length > 0) {
        result.reason = reason;
      }
    }
    results.push(result);
  });
  return results;
};

export default processHits;
