<div align="center">

# 🔍 Solr Smart Search UI

**A production-grade, full-featured search interface built on Apache Solr**  
Real-time search · Faceted navigation · Autocomplete · Highlighting · Pagination

<br/>

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Apache Solr](https://img.shields.io/badge/Apache_Solr-9-D9411E?style=for-the-badge&logo=apache&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-1.6-5A29E4?style=for-the-badge&logo=axios&logoColor=white)

<br/>

> **Lab 13 — Open Ended Lab**  
> *This project was built as part of a university Information Retrieval lab, demonstrating integration between a React frontend and Apache Solr search engine via a Node.js proxy.*

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Set Up Apache Solr](#2-set-up-apache-solr)
  - [3. Set Up the Proxy Server](#3-set-up-the-proxy-server)
  - [4. Set Up the React App](#4-set-up-the-react-app)
- [Running the Project](#-running-the-project)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)
- [How It Works](#-how-it-works)
- [Screenshots](#-screenshots)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Real-time Search** | Results update as you type with 400ms debounce to avoid hammering Solr |
| 💡 **Autocomplete** | Live title suggestions appear after 2+ characters, powered by Solr wildcard queries |
| 🗂 **Faceted Navigation** | Filter by Category and Brand — counts update dynamically with every search |
| 💰 **Price Range Filter** | Min/Max numeric inputs that translate to Solr range queries (`price:[50 TO 200]`) |
| ⭐ **Rating Filter** | One-click minimum star rating filter |
| 📄 **Smart Pagination** | Windowed page numbers (First / Prev / 1…5 / Next / Last) with smooth scroll-to-top |
| ↕ **Sorting** | Sort by Relevance, Price (asc/desc), Rating, or Review Count |
| 🖍 **Term Highlighting** | Matched search terms are wrapped in `<mark>` tags and rendered with a glow effect |
| 🏷 **Active Filter Tags** | Every active filter shown as a removable tag pill above results |
| ⌛ **Search History** | Last 6 searches remembered and shown as clickable chips |
| 🔥 **Smart Badges** | Products auto-tagged as "Hot" (rating ≥ 4.5) or "Trending" (reviews > 1,000) |
| 🛡 **Schema-Aware Proxy** | Proxy reads your Solr schema on startup and only requests fields that actually exist |
| 📱 **Responsive Design** | Sidebar collapses on mobile, grid adapts from 3 columns down to 1 |
| 🐛 **Debug Endpoints** | `/health`, `/schema`, and `/search?q=*:*` URLs for easy local debugging |

---

## 📁 Project Structure

```
solr-ui/                          ← Root of your Vite/React project
│
├── proxy/                        ← Node.js proxy server (separate process)
│   ├── server.js                 ← ✅ Express proxy — put this here
│   └── package.json              ← needs express, axios, cors
│
├── src/
│   ├── App.jsx                   ← ✅ Main React app — replace this
│   ├── main.jsx                  ← Vite entry point (unchanged)
│   └── index.css                 ← Global resets (can leave as-is)
│
├── index.html                    ← Vite HTML shell (unchanged)
├── vite.config.js                ← Vite config (unchanged)
└── package.json                  ← React app dependencies
```

> **Note:** The proxy and the React app are two separate Node processes running on different ports. Both must be running at the same time.

---

## 🛠 Tech Stack

### Frontend
- **React 18** — UI library with hooks (`useState`, `useEffect`, `useCallback`, `useRef`)
- **Vite** — lightning-fast dev server and bundler
- **Axios** — HTTP client for API calls to the proxy
- **CSS-in-JS (style tag)** — all styles are self-contained inside `App.jsx`, no external stylesheet needed
- **Google Fonts** — Space Grotesk (headings) + DM Sans (body)

### Backend / Proxy
- **Node.js** — runtime for the proxy server
- **Express** — lightweight HTTP server framework
- **Axios** — used server-side to forward requests to Solr
- **CORS** — allows the React dev server (port 5173) to talk to the proxy (port 3001)

### Search Engine
- **Apache Solr** — the core search engine
  - Select handler (`/select`) for search and faceting
  - Schema API (`/schema/fields`) for field introspection
  - Features used: full-text search, filter queries (`fq`), faceting, highlighting, sorting, pagination

---

## 📦 Prerequisites

Make sure you have the following installed before starting:

| Tool | Version | Check |
|---|---|---|
| **Node.js** | v18 or higher | `node --version` |
| **npm** | v9 or higher | `npm --version` |
| **Java** | JDK 11 or higher (for Solr) | `java -version` |
| **Apache Solr** | v8 or v9 | `solr version` |

> **Don't have Solr?** Download it from [solr.apache.org](https://solr.apache.org/downloads.html). Extract the zip/tar, and the `bin/` folder contains the `solr` (Linux/Mac) or `solr.cmd` (Windows) executable.

---

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/solr-search-ui.git
cd solr-search-ui
```

---

### 2. Set Up Apache Solr

#### Start Solr

**Windows:**
```powershell
cd C:\path\to\solr-9.x.x
.\bin\solr.cmd start
```

**Linux / macOS:**
```bash
cd ~/solr-9.x.x
bin/solr start
```

Verify Solr is running by opening **http://localhost:8983/solr/** in your browser. You should see the Solr Admin UI.

#### Create a Core

If you don't already have a core called `products`, create one:

**Windows:**
```powershell
.\bin\solr.cmd create -c products
```

**Linux / macOS:**
```bash
bin/solr create -c products
```

> **Using a different core name?** Open `proxy/server.js` and change the `SOLR_BASE` constant on line 8 to match your core name:
> ```js
> const SOLR_BASE = 'http://localhost:8983/solr/YOUR_CORE_NAME';
> ```

#### Index Some Data (if your core is empty)

If you already have data indexed, skip this step. Otherwise, Solr ships with example data you can use:

```bash
# From the Solr root directory — index the example techproducts dataset
bin/solr post -c products example/exampledocs/*.xml
```

Or index a custom JSON file:
```bash
bin/solr post -c products /path/to/your/data.json
```

---

### 3. Set Up the Proxy Server

```bash
# Navigate to the proxy directory
cd proxy

# Install dependencies (express, axios, cors)
npm install

# Verify the install succeeded — you should see 0 vulnerabilities
```

The proxy's `package.json` should look like this. If it doesn't, replace it:

```json
{
  "name": "solr-proxy",
  "version": "1.0.0",
  "description": "CORS proxy for Apache Solr",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "cors": "^2.8.5",
    "express": "^4.18.0"
  }
}
```

---

### 4. Set Up the React App

```bash
# Go back to the project root
cd ..

# Install React app dependencies
npm install
```

---

## ▶️ Running the Project

You need **three things running** at the same time. Open three separate terminal windows:

**Terminal 1 — Apache Solr**
```powershell
# Windows
cd C:\path\to\solr-9.x.x
.\bin\solr.cmd start

# Linux / macOS
cd ~/solr-9.x.x && bin/solr start
```

**Terminal 2 — Proxy Server**
```bash
cd solr-search-ui/proxy
npm start
```

You should see:
```
✅  Proxy running  →  http://localhost:3001
📡  Solr target    →  http://localhost:8983/solr/products

🔍  Paste these in your browser to debug:
    Health : http://localhost:3001/health
    Schema : http://localhost:3001/schema
    Search : http://localhost:3001/search?q=*:*
```

**Terminal 3 — React App**
```bash
cd solr-search-ui
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in 300ms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser — the search UI is ready.

---

## ⚙️ Configuration

### Change the Solr Core

Edit the first constant in `proxy/server.js`:

```js
// Line 8 — change 'products' to your actual core name
const SOLR_BASE = 'http://localhost:8983/solr/products';
```

### Change Results Per Page

Edit the constant at the top of `src/App.jsx`:

```js
const PER_PAGE = 12; // change to 8, 24, 50, etc.
```

### Change the Proxy Port

Edit the last few lines of `proxy/server.js`:

```js
const PORT = 3001; // change if 3001 is already in use
```

Then update the matching constant in `src/App.jsx`:

```js
const PROXY = 'http://localhost:3001'; // match whatever port you set above
```

### Adapt to Your Schema

The proxy automatically reads your Solr schema on first request and only enables facets, highlights, and sorting on fields that actually exist. It checks for these field names by default:

| Feature | Fields checked (in order) |
|---|---|
| Facets | `category`, `cat`, `genre`, `brand`, `manufacturer`, `manu`, `type` |
| Highlights | `title`, `name`, `description`, `desc`, `content` |
| Autocomplete | `title`, `name`, `content` |

If your Solr schema uses different field names, update the candidate lists inside `proxy/server.js`:

```js
// Around line 66 — add your actual field names here
const facetCandidates = ['category', 'cat', 'your_custom_field'];

// Around line 77 — add your text fields here
const hlCandidates = ['title', 'name', 'your_text_field'];
```

---

## 📡 API Reference

All endpoints are served by the proxy on port `3001`.

### `GET /search`

Performs a search against Solr and returns results with facets and highlights.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | `*:*` | Search query. Use `*:*` for all documents |
| `fq` | string / string[] | — | Filter query. Can be passed multiple times. e.g. `fq=category:Electronics&fq=brand:Sony` |
| `sort` | string | — | Sort expression. e.g. `price asc`, `rating desc` |
| `start` | number | `0` | Offset for pagination (0-indexed) |
| `rows` | number | `12` | Number of results to return |

**Example:**
```
GET http://localhost:3001/search?q=headphones&fq=category:Electronics&sort=price+asc&rows=12&start=0
```

**Response shape:**
```json
{
  "response": {
    "numFound": 247,
    "start": 0,
    "docs": [ { "id": "...", "title": "...", "price": 99.99, ... } ]
  },
  "facet_counts": {
    "facet_fields": {
      "category": ["Electronics", 92, "Audio", 58],
      "brand":    ["Sony", 34, "Bose", 28]
    }
  },
  "highlighting": {
    "doc-id-1": { "title": ["<mark>Headphones</mark> Pro X"] }
  },
  "_meta": {
    "facetFields": ["category", "brand"],
    "hlFields": ["title", "description"],
    "allFields": ["id", "title", "price", "rating", ...]
  }
}
```

---

### `GET /suggest`

Returns autocomplete suggestions based on a partial query string.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `q` | string | Partial search term (minimum 2 characters) |

**Example:**
```
GET http://localhost:3001/suggest?q=wire
```

**Response:**
```json
{
  "suggestions": [
    "Wireless Headphones Pro X",
    "Wireless Earbuds",
    "Wireless Keyboard"
  ]
}
```

---

### `GET /health`

Checks whether Solr is reachable. Useful for debugging.

**Response (success):**
```json
{ "status": "ok", "solr": "http://localhost:8983/solr/products" }
```

**Response (failure):**
```json
{ "status": "error", "solr": "...", "details": "connect ECONNREFUSED 127.0.0.1:8983" }
```

---

### `GET /schema`

Returns a sorted list of all field names in your Solr core. Useful for adapting the proxy to your data.

**Response:**
```json
{
  "fields": ["brand", "category", "description", "id", "price", "rating", "title", ...]
}
```

---

## 🐛 Troubleshooting

### ❌ `Cannot find module 'server.js'`

The `proxy/server.js` file is missing. Copy the `server.js` file from this repo into the `proxy/` folder, then run `npm start` again.

---

### ❌ Proxy error: `Request failed with status code 500`

The proxy is running, but Solr returned an error. Follow these steps:

**Step 1 — Check health:**
```
http://localhost:3001/health
```
If this returns `"status": "error"`, Solr is either not running or the core name is wrong.

**Step 2 — Check your core name:**  
Open `http://localhost:8983/solr/` → look at the core selector on the left panel. Copy that name and update line 8 of `proxy/server.js`.

**Step 3 — Check your schema:**
```
http://localhost:3001/schema
```
This lists every field in your core. If `category`, `brand`, `price`, or `rating` don't appear, the proxy will skip those features automatically — but your data might be indexed under different field names.

**Step 4 — Test Solr directly:**  
Open this in your browser (replace `products` with your core):
```
http://localhost:8983/solr/products/select?q=*:*&wt=json&rows=5
```
If this works, the problem is in the proxy layer. If it fails, the problem is with Solr or your core.

---

### ❌ Blank results / "No products found"

Your core might be empty. Verify by opening:
```
http://localhost:8983/solr/products/select?q=*:*&wt=json&rows=1
```
Check `response.numFound`. If it's `0`, you need to index data. See the [Index Some Data](#index-some-data-if-your-core-is-empty) section above.

---

### ❌ CORS error in the browser console

This means the React app can't reach the proxy. Make sure:
- The proxy is actually running (`npm start` inside the `proxy/` folder)
- The proxy started on port `3001` (check the terminal output)
- The `PROXY` constant in `App.jsx` matches the port the proxy is running on

---

### ❌ Facets / Filters don't appear in the sidebar

The proxy only enables facets for fields it finds in your Solr schema. If your fields are named differently (e.g. `genre` instead of `category`), add them to the `facetCandidates` array in `proxy/server.js`. See the [Adapt to Your Schema](#adapt-to-your-schema) section.

---

### ❌ Port 3001 or 5173 already in use

Find and kill the process using that port:

**Windows:**
```powershell
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F
```

**Linux / macOS:**
```bash
lsof -ti:3001 | xargs kill
```

---

## 🏗 How It Works

```
Browser (port 5173)
      │
      │  HTTP GET /search?q=headphones
      ▼
Node.js Proxy (port 3001)
      │
      │  1. Reads Solr schema to discover available fields
      │  2. Builds a safe URLSearchParams object
      │  3. Only adds faceting/highlighting for fields that exist
      │  4. Forwards to Solr
      │
      │  HTTP GET /solr/products/select?q=headphones&facet=true&...
      ▼
Apache Solr (port 8983)
      │
      │  Returns JSON: docs, facet_counts, highlighting
      ▼
Node.js Proxy
      │  Attaches _meta (which fields were used)
      │  Returns enriched JSON to the browser
      ▼
React App
      │  Updates state: results, facets, highlights
      │  Re-renders product grid, sidebar filters, pagination
```

### Why a proxy?

Browsers block direct requests from a web page to Solr due to CORS restrictions. The Node.js proxy sits in between, adds CORS headers, and also lets us keep the Solr URL private (so it's not exposed in the frontend code).

### Schema introspection

On the first search request, the proxy calls `/schema/fields` to get every field in your Solr core. It caches this list and uses it to decide which facet fields to request and which fields to highlight — so the app works on *any* Solr core, not just one with a fixed schema.

---

## 👤 Author

**Muhammad Anas** — Lab 13, Open Ended Lab  
Built with React, Vite, Express, and Apache Solr.

---

<div align="center">
<sub>⭐ If this helped you, consider starring the repo!</sub>
</div>
