# EdgeIDE
### A Touch-Optimized Code Studio for Mobile and Desktop

EdgeIDE is a fast, versatile code editor and development environment built to work consistently across devices—including phones, tablets, laptops, and desktops. Whether writing Python on the go, building web applications, testing algorithms, or transferring project files between devices, EdgeIDE provides a distraction-free coding experience with zero configuration required.

---

## Overview

EdgeIDE combines mobile touch ergonomics with desktop developer workflows. It is designed to be lightweight, responsive, and adaptable:

* **On Mobile and Tablets**: Features a touch-first interface with a dedicated accessory bar for brackets and symbols, swipeable file navigation, and standalone offline execution.
* **On Laptops and Desktops**: Operates as a full desktop workspace with standard keyboard shortcuts, resizable sidebars, on-device terminal access, and direct hardware execution.

---

## Key Features

### 1. Hardware-Aware Execution
EdgeIDE dynamically adapts its execution model based on the host device:
* **On Laptops and Desktops**: Automatically connects to the host machine's native Python installation, providing access to locally installed packages (`numpy`, `pandas`, `torch`, `opencv`, etc.), local file storage, and hardware GPU acceleration.
* **On Mobile and Offline Devices**: Executes code entirely on-device using isolated WebAssembly (Python 3.12 via Pyodide), enabling execution without an active internet connection or remote server.

---

### 2. Peer-to-Peer File Transfer
Transfer files and complete project directories between devices securely and directly:
* **Direct Transfer**: Pair devices instantly using dynamic QR codes.
* **Access Control**: Choose between 4-digit PIN verification, whitelisted trusted devices, or offline QR transfer.
* **One-Step Import**: Received files and directories are automatically structured in the local workspace and can be opened immediately in the editor.

---

### 3. Hot-Exit Drafts and Quick Notes
Capture temporary ideas and test snippets without affecting the project directory:
* **Quick Scratchpads (`Ctrl+T` or `+`)**: Create untitled drafts instantly without needing to define a file path first.
* **Persistent Memory**: Unsaved tabs remain preserved across application restarts and page refreshes.
* **Direct Commit**: Save drafts to the workspace at any time with pre-configured extension selectors (`.py`, `.js`, `.html`, `.txt`, `.md`, etc.).

---

### 4. Touch Ergonomics and Desktop Shortcuts
* **Programmer Accessory Bar**: Quick-tap access to frequently used coding symbols (`{ }`, `( )`, `[ ]`, `;`, `=>`, `" "`, `:`, `_`, `$`) and directional navigation buttons directly above the mobile software keyboard.
* **Desktop Keyboard Shortcuts**: Support for standard keybindings (`Ctrl+S` to save, `Ctrl+T` for new tab, `Ctrl+Enter` to execute, `Ctrl+F` to search).
* **Adaptive Navigation**: Switch seamlessly between a touch-friendly slide-over drawer on mobile and a pinned, resizable sidebar on desktop screens.

---

### 5. Integrated Terminal and Package Management
* **Built-in Shell**: Full ANSI terminal with file system navigation (`ls`, `cd`, `cat`, `mkdir`, `rm`), Git integration, and an interactive Python REPL.
* **Package Management**: Install PyPI libraries directly within the environment using `pip install <package>`.
* **Host Shell Pass-Through**: Execute commands directly on the host operating system (`! dir`, `! git status`, `! pip install`) when connected in desktop mode.

---

### 6. Live Web App Preview
* Multi-file live preview for frontend development (`HTML`, `CSS`, and `JavaScript`).
* Real-time rendering with responsive viewport toggling (Mobile and Desktop views) and an integrated console inspector for logs and errors.

---

### 7. Customization and Themes
* **Syntax Themes**: Multiple built-in editor themes, including One Dark, Dracula, Tokyo Night, Monokai, Nord, Synthwave '84, GitHub Dark, GitHub Light, and Solarized Dark.
* **Accent Colors**: Customizable interface accent colors with live preview.
* **Typography**: Select from popular developer monospace fonts (*JetBrains Mono*, *Fira Code*, *Cascadia Code*, *SF Mono*, *Source Code Pro*, *Roboto Mono*) with adjustable font sizing.
* **Theme Modes**: Dedicated Dark and Light interface modes.

---

## Supported Platforms

EdgeIDE runs across all major operating systems:

* **Windows / macOS / Linux**: Runs in any modern browser or installs as a standalone, frameless Desktop PWA with taskbar and start menu integration.
* **Android**: Available as a native APK or installable via browser PWA.
* **iOS / iPadOS**: Installable directly to the Home Screen from Safari with full screen support and gesture navigation.

---

## Getting Started

1. **Open EdgeIDE** in a supported browser or launch the installed application.
2. **Create or Open a File**: Use the file explorer to structure projects, or press `Ctrl+T` / `+` to open an instant scratchpad.
3. **Write and Execute**: Write code with syntax highlighting and auto-completion, then run the active file (`Ctrl+Enter`) to view terminal output or live web previews.
