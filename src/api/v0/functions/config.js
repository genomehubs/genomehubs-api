require("dotenv").config();

export const config = {
  hub: process.env.GH_HUBNAME || "demo",
  node: process.env.GH_NODE || "http://localhost:9200",
  separator: process.env.GH_SEPARATOR || "--",
  taxonomy: process.env.GH_TAXONOMY || "ncbi",
  release: process.env.GH_RELEASE || "v0.1",
  port: process.env.GH_PORT || 3000,
  cors: process.env.GH_ORIGINS.split(" "),
  https: String(process.env.GH_HTTPS) === "true",
  keyFile: process.env.GH_KEYFILE,
  certFile: process.env.GH_CERTFILE,
  description: process.env.GH_DESCRIPTION || "Genomes on a Tree OpenAPI test",
  title: process.env.GH_TITLE || "GoaT",
  contactName: process.env.GH_CONTACTNAME || "GoaT",
  contactEmail: process.env.GH_CONTACTEMAIL || "goat@genomehubs.org",
  url: process.env.GH_URL || "https://goat.genomehubs.org/api/v0.0.1",
};
