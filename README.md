<img src="assets/logo.svg" alt="wiretracks" width="300" />

**Wiretracks** is a next-generation schematic capture and PCB routing environment that operates entirely within your web browser. Traditional Electronic Design Automation (EDA) software can be slow, bloated, and tied to specific operating systems. Wiretracks reimagines EDA as a modern, local-first web application. Your designs never leave your machine unless you want them to. With a focus on performance, the custom rendering engine handles thousands of components and nets without breaking a sweat.

## Key Features

### ⚡ Blazing Fast Canvas
- **Custom Rendering:** A highly optimized WebGL/HTML5 Canvas workspace that renders massive schematics quickly, preventing the UI lag common in web-based CAD tools.
- **Fluid Interactions:** Pan, zoom, and select with zero dropped frames, providing a native-app feel entirely within the browser.

### 🧠 Intelligent Auto-Routing
- **Orthogonal A* Pathfinder:** Wiretracks includes a custom-built routing engine that automatically finds clean, orthogonal paths between component pins, avoiding obstacles and crossing lines intelligently.
- **Dynamic Updates:** Wires actively re-route, snap, and adjust in real-time as you move components around the canvas.

### 🔒 Local-First Architecture
- **Zero Server Dependency:** There is no backend. Wiretracks uses a local SQLite compatibility layer compiled to WebAssembly (via SQL.js) that persists data directly to your browser's IndexedDB.
- **Privacy by Default:** Your component libraries, project files, schemas, and layouts are stored entirely on your local machine.

### 🤖 Sparky: The CAD Copilot
- **AI Integration:** Includes an integrated AI assistant ("Sparky") that understands your schematic context.
- **Automated Drafting:** Ask Sparky to review your connections, suggest component replacements, or parse external datasheets directly within the sidebar.

### 📦 Manufacturing & Export
- **BOM & CPL Generation:** Automatically generate Bill of Materials (BOM) and Component Placement Lists (CPL) for seamless integration with PCBA manufacturers like JLCPCB.
- **Part Search:** Integrated API connections to LCSC / JLCPCB parts catalogs. Find components, check stock, and pull their symbols directly into your design.

## Architecture & Tech Stack

Wiretracks is a Single Page Application (SPA) built with modern web technologies to maximize performance and portability.

- **Framework:** React + Vite for rapid development, state management, and optimized production builds.
- **Database:** SQL.js backing into IndexedDB for full relational database capabilities purely on the client-side. The entire library is queryable via standard SQL.
- **Routing Engine:** A custom-written A* pathfinding algorithm optimized for orthogonal electronic net routing.
- **Styling:** Tailwind CSS (via PostCSS) for rapid, consistent UI component design.

## Project Structure

- `/src/components`: React components including the core `SchematicCanvas`, `SidebarLibrary`, and `SidebarAiChat`.
- `/src/utils`: Core logic engines including the `router.js` pathfinder, `electricalSimulation.js` physics engine, and `sqliteDb.js` local-first database adapter.
- `/public`: Static assets and base HTML.

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- A modern web browser with WebAssembly support (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/annabellaproctor/wiretracks.git
   cd wiretracks
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:5173`.

## Data Management & Backups

Because Wiretracks is entirely local-first, it is highly recommended to periodically back up your work. You can easily export your entire IndexedDB state or individual schematic projects as JSON files from the settings menu to back them up or share them with collaborators.
