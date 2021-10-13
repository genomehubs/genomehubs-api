# Goat API

A draft OpenAPI implementation for Genomes on a Tree

## Install

```
conda create -n goat_api_env -c conda-forge -y nodejs=14
conda activate goat_api_env
```

```
git clone https://github.com/tolkit/goat-api
cd goat-api
npm install
npm start
```

## Usage

```
curl http://localhost:3000/api/v2/taxon/3702?indent=2
```

## Docs

- [GoaT API docs](http://localhost:3000/api-docs)
- [GoaT API spec](http://localhost:3000/spec)
