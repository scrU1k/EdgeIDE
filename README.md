# AeroIDE - Mobile On-Device Web IDE 🚀

A lightweight, touch-optimized, mobile-first Web IDE designed to run code **100% on-device** using WebAssembly (WASM) and isolated client-side execution engines with zero backend server dependencies.

---

## 📱 Features

- **Mobile-First Touch UX**:
  - **CodeMirror 6** editor tuned for mobile touch keyboards and IME input.
  - **Sticky Accessory Bar**: Quick-tap programming symbols (`{ }`, `( )`, `[ ]`, `;`, `=>`, `" "`, `_`, `$`, etc.) and cursor navigation arrows (`◀`, `▶`).
  - **Touch File Drawer**: Swipe/tap to browse, create, rename, and delete virtual files.
  - **Tab Bar**: Switch seamlessly between open files.
  
- **On-Device Execution Engines (Pure Client-Side / Zero Backend)**:
  - 🐍 **Python 3.12 (Pyodide WASM)**: Runs full CPython compiled to WebAssembly. Supports standard library (`math`, `time`, `json`, `statistics`, etc.) with in-memory multi-file imports!
  - ⚡ **JavaScript / TypeScript**: Safe execution with interactive console formatting (`console.log`, `console.warn`, `console.error`, `console.table`).
  - 🌐 **Live Web Preview**: Sandboxed `<iframe>` that auto-bundles `index.html`, `style.css`, and `app.js` with console log interception.
  
- **Offline & Cross-Platform**:
  - **Virtual File System (VFS)**: Persistent local storage across app refreshes.
  - **iOS / Safari PWA**: Installable as a Progressive Web App directly to the Home Screen.
  - **Android Capacitor**: Ready to package as a native Android APK via `@capacitor/cli`.

---

## 🛠️ Getting Started

### 1. Run in Development Mode
```bash
npm install
npm run dev
```
Open `http://localhost:3000` (or your local network IP on your mobile device) to test.

### 2. Build for Production / PWA
```bash
npm run build
npm run preview
```

### 3. Build Native Android App (Capacitor)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npm run build
npx cap copy
npx cap open android
```

---

## 📂 Project Architecture

```
src/
├── components/          # Mobile UI Components
│   ├── AccessoryBar.ts  # Programmer keyboard accessory row
│   ├── FileTreeDrawer.ts# Mobile file browser drawer
│   ├── Header.ts        # Top bar with Run button & indicators
│   ├── OutputPanel.ts   # Slide-up console & live web preview
│   └── TabBar.ts        # Open tabs switcher
├── editor/
│   └── editor.ts        # CodeMirror 6 configuration & themes
├── runtimes/            # On-Device Language Engines
│   ├── html-preview.ts  # Inlined HTML/CSS/JS live preview builder
│   ├── js-runtime.ts    # JavaScript execution engine
│   ├── python-runtime.ts# Pyodide WASM Python 3.12 engine
│   ├── runtime-manager.ts # Central dispatcher
│   └── types.ts         # Runtime interfaces
├── vfs/                 # Virtual File System
│   ├── types.ts         # File and project state types
│   └── vfs.ts           # Local storage persistence & starter templates
├── main.ts              # App entrypoint & component orchestration
└── style.css            # Dark theme, mobile touch styling & animations
```
