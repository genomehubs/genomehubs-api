const { Client } = require("@elastic/elasticsearch");

export const client = new Client({ node: "http://localhost:9200" });
