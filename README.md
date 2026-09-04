# Penqwin Desktop - Local Engineering Documentation

> **Your docs stay in sync with your local code. Automatically, privately, and offline.**

Penqwin Desktop is an Electron-based application that brings the power of AI-assisted engineering documentation directly to your local file system. It generates, organizes, and updates structured engineering documentation based on your local git commits and file diffs, keeping everything stored locally on your machine.

[![License: ELv2](https://img.shields.io/badge/License-Elastic_v2-lightblue.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron)](https://electronjs.org)
[![Vite](https://img.shields.io/badge/Vite-Build_Tool-646CFF?logo=vite)](https://vitejs.dev)
[![React](https://img.shields.io/badge/React-UI-61DAFB?logo=react)](https://react.dev)

---

## How It Works

1. **Connect** your local git repository directly through the desktop app.
2. **Bootstrap** — Penqwin scans your local repository structure and generates a full initial documentation set using Gemini AI.
3. **Sync** — Select recent local commits, and Penqwin calculates the diff, identifies affected files, and updates only the relevant documentation sections.
4. **Organize** — Manage multiple isolated workspaces, allowing you to keep documentation for different projects completely separate.
5. **Search** — A fully offline, full-text search engine instantly finds documents based on their titles or deep within their rich-text contents.
6. **Edit** — A rich Tiptap editor lets you refine your docs alongside the AI-generated content.

---

## Features

| Feature                         | Description                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Local Privacy First**         | Reads directly from your local file system and git history. No cloud backend or databases required.    |
| **Repository Bootstrap**        | Auto-discovers files from your local repo structure and generates an initial codebase reference doc.   |
| **Git Diff Sync**               | Select local commits to generate "Changeset Summaries" that automatically track your ongoing work.     |
| **Multi-Workspace Support**     | Create, rename, and manage completely isolated workspaces for different local projects.                |
| **Offline Full-Text Search**    | Instantly search document titles and body contents with live highlighting and context snippets.        |
| **Rich Editor**                 | Tiptap-powered editor with tables, code blocks, drag-to-reorder, and markdown support.                 |

---

## Tech Stack

| Layer              | Technology                                  |
| ------------------ | ------------------------------------------- |
| App Container      | Electron                                    |
| Build Tool         | Vite                                        |
| Framework          | React 19 + TypeScript                       |
| Database           | Dexie.js (IndexedDB) for local persistence  |
| AI Integration     | Google Gemini (via `@google/generative-ai`) |
| Editor             | Tiptap 3                                    |
| UI Styling         | Tailwind CSS + MUI Icons                    |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Git installed on your system
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key

### Setup & Run

```bash
# 1. Clone the repository (if you haven't already)
git clone https://github.com/Penqwin/desktop-app.git
cd desktop-app

# 2. Install dependencies
npm install

# 3. Start the application in development mode
# This spins up the Vite dev server and the Electron app concurrently
npm run dev
```

### Building for Production

To package the application into a standalone executable for your operating system:

```bash
# Build the React frontend and compile Electron processes
npm run build
```
*(Note: You may use electron-builder commands to explicitly compile binaries for Windows, macOS, or Linux).*

---

## Usage Guide

1. **Configure API Key:** On the first launch, click on the **Settings** gear icon and enter your Gemini API key.
2. **Create a Workspace:** Click the workspace dropdown in the sidebar to create a dedicated environment for your project.
3. **Bootstrap a Project:** Click the **Automagic** button and select a local directory. The app will read your code and generate a `Code Reference` folder.
4. **Generate Changesets:** Make local commits to your codebase. In Penqwin, select those commits in the "Generate Doc" modal to produce a summarized log of your updates.

---

## License

This software is licensed under the [Elastic License 2.0](./LICENSE).

**In short:** You can use, modify, and run this software freely. You may not offer it as a managed/hosted service to third parties.

---

*Built for high-performance offline engineering documentation.*
