# MaKo Knowledge Management System - User Guide

**A comprehensive documentation management and search platform for APE & Billing documentation**

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation and Setup](#installation-and-setup)
   - [macOS Setup](#macos-setup)
   - [Windows Setup](#windows-setup)
3. [Starting the Application](#starting-the-application)
   - [macOS](#starting-on-macos)
   - [Windows](#starting-on-windows)
4. [Using the Application](#using-the-application)
   - [Browsing Documents](#browsing-documents)
   - [Searching Documents](#searching-documents)
   - [Uploading Documents](#uploading-documents)
5. [Document Preparation](#document-preparation)

---

## System Requirements

### macOS
- macOS 10.14 (Mojave) or later
- Python 3.7 or later
- Modern web browser (Safari, Chrome, Firefox, or Edge)
- At least 500 MB free disk space

### Windows
- Windows 10 or later
- Python 3.7 or later
- Modern web browser (Chrome, Firefox, or Edge)
- At least 500 MB free disk space

---

## Installation and Setup

### macOS Setup

#### Step 1: Verify Python Installation

Open Terminal (Applications → Utilities → Terminal) and check if Python 3 is installed:

```bash
python3 --version
```

If Python is not installed, download it from [python.org](https://www.python.org/downloads/) or install using Homebrew:

```bash
brew install python3
```

#### Step 2: Navigate to Application Directory

```bash
cd /path/to/docMng_toShare
```

Replace `/path/to/docMng_toShare` with the actual path where you extracted the application.

#### Step 3: Install Dependencies

```bash
pip3 install -r requirements.txt
```

This will install:
- Flask 3.0.0 (web framework)
- flask-cors 4.0.0 (cross-origin support)
- Werkzeug 3.0.1 (WSGI utilities)

#### Step 4: Make Start Script Executable (First Time Only)

```bash
chmod +x start_server.sh
```

---

### Windows Setup

#### Step 1: Verify Python Installation

Open Command Prompt (press `Win + R`, type `cmd`, press Enter) and check if Python is installed:

```cmd
python --version
```

If Python is not installed, download it from [python.org](https://www.python.org/downloads/windows/).

**Important:** During installation, check the box "Add Python to PATH".

#### Step 2: Navigate to Application Directory

```cmd
cd C:\path\to\docMng_toShare
```

Replace `C:\path\to\docMng_toShare` with the actual path where you extracted the application.

#### Step 3: Install Dependencies

```cmd
pip install -r requirements.txt
```

This will install the required Python packages.

---

## Starting the Application

### Starting on macOS

#### Option 1: Using the Start Script (Recommended)

In Terminal, navigate to the application directory and run:

```bash
./start_server.sh
```

The script will:
- Stop any existing instances of the server
- Start the Flask server on port 5001
- Display startup messages

#### Option 2: Manual Start

```bash
python3 app.py
```

#### Accessing the Application

Once started, you'll see output like:

```
 * Running on http://127.0.0.1:5001
 * Running on http://localhost:5001
```

Open your web browser and navigate to:

```
http://localhost:5001
```

---

### Starting on Windows

#### Open Command Prompt

Press `Win + R`, type `cmd`, press Enter.

#### Navigate to Application Directory

```cmd
cd C:\path\to\docMng_toShare
```

#### Start the Server

```cmd
python app.py
```

**Note:** If `python` doesn't work, try `python3` or `py`:

```cmd
py app.py
```

#### Accessing the Application

Once started, you'll see output like:

```
 * Running on http://127.0.0.1:5001
 * Running on http://localhost:5001
```

Open your web browser and navigate to:

```
http://localhost:5001
```

---

## Using the Application

#### Header Bar
- **Upload Button**: Click to upload new documents

#### Sidebar (Left Panel)
- **Search Mode Toggle**: Switch between Title Search and Content Search
- **Search Box**: Enter search terms
- **Indexing Status**: Shows when content is being indexed
- **Navigation Tree**: Expandable/collapsible document structure

#### Content Area (Right Panel)
- Displays selected documents
- Shows search results
- Welcome screen when no document is selected

---

### Browsing Documents

#### Step 1: Navigate the Tree Structure

Documents are organized hierarchically in the sidebar:

```
▼ APE
  ▼ User Management
    • Creating Users
    • Editing Permissions
  ▼ Reports
    • Monthly Reports
    • Custom Reports
```

- **▼** = Expanded category (click to collapse)
- **▶** = Collapsed category (click to expand)
- **•** = Document (click to view)

#### Step 2: Click to View

Click on any document title in the navigation tree. The document will:
- Load in the content area
- Be highlighted in the sidebar
- Display with all images and formatting

#### Step 3: Navigate Between Documents

Simply click on another document to switch views. The sidebar stays visible for easy navigation.

---

### Searching Documents

This application offers two powerful search modes:

#### Title Search (Quick Navigation)

**Best for:** Finding documents when you know part of the title

1. **Select "Search Titles" mode** (radio button in sidebar)
2. **Type in the search box** (e.g., "user management")
3. **Results appear instantly:**
   - Non-matching documents are hidden
   - Matching documents and their parent categories remain visible
   - Categories auto-expand to show matches

**Example:**
- Search: `user`
- Shows: All documents with "user" in the title
- Hides: Everything else

4. **Clear search** by deleting text in the search box

#### Content Search (Deep Search)

**Best for:** Finding specific information within documents

1. **Select "Search Content" mode** (radio button in sidebar)
2. **Type your search term** (e.g., "password reset")
3. **Review results** displayed in the content area:
   - Document titles are shown
   - Context snippets display surrounding text
   - Search terms are highlighted
   - Number of matches shown

**Example Search Result:**

```
Found in: APE > User Management > Password Policies

"...users can request a password reset by clicking the
Forgot Password link. The system will send a secure reset
link to their registered email address..."

Click to view full document
```

4. **Click on a result** to view the full document

---

### Uploading Documents

#### Prerequisites

Before uploading, ensure your document:
- Is in `.doc` format (Microsoft Word 97-2003)
- Contains a "Navigation:" header (see [Document Preparation](#document-preparation))

#### Upload Steps

**Step 1: Click "Upload Document"**

Click the blue "Upload Document" button in the top-right corner.

**Step 2: Select or Drag File**

Two options:
- **Drag and drop:** Drag a `.doc` file into the modal window
- **Click to browse:** Click the upload area to open file picker

**macOS File Picker:**
- Navigate using Finder interface
- Select your `.doc` file
- Click "Open"

**Windows File Picker:**
- Navigate using Windows Explorer interface
- Select your `.doc` file
- Click "Open"

**Step 3: Monitor Upload Progress**

A progress bar shows upload status:
- Blue bar fills as upload progresses
- Percentage indicator updates

**Step 4: Wait for Processing**

The system will:
1. Upload the file
2. Extract HTML content
3. Extract embedded images
4. Parse navigation structure
5. Index content for searching

**Step 5: Confirmation**

Upon success:
- "Upload successful!" message appears
- Modal closes automatically
- Document appears in navigation tree
- Original `.doc` file is deleted from server

---

## Document Preparation

### Required Format

Documents MUST be in `.doc` format (Microsoft Word 97-2003 Document).

**Converting from .docx to .doc:**

**macOS:**
1. Open document in Microsoft Word
2. File → Save As
3. Format: "Word 97-2004 Document (.doc)"
4. Click Save

**Windows:**
1. Open document in Microsoft Word
2. File → Save As
3. Save as type: "Word 97-2003 Document (*.doc)"
4. Click Save

### Navigation Header

Every document MUST include a navigation header on the first line:

```
Navigation: Section > Category > SubCategory > ... > Document Title
```

**Examples:**

```
Navigation: APE > User Management > Creating New Users
Navigation: Billing > Reports > Monthly Revenue Reports
Navigation: APE > System Admin > Database Backup Procedures
```

**Format Rules:**
- Must start with "Navigation:" (case-sensitive)
- Use " > " (space-greater than-space) as separator
- 2-4 levels recommended
- First level typically: "APE" or "Billing"

**Template Structure:**

```
Navigation: APE > Category Name > Document Title

[Rest of your document content goes here]

Document body text...
```

### Example Template

See `TEMPLATE.doc` in the application folder for a working example.

---

## Quick Reference Commands

### macOS

```bash
# Navigate to application
cd /path/to/docMng_toShare

# Install dependencies (first time only)
pip3 install -r requirements.txt

# Start server (recommended)
./start_server.sh

# Start server (manual)
python3 app.py

# Stop server
Press Ctrl+C in Terminal

# Check if server is running
lsof -i:5001
```

### Windows

```cmd
# Navigate to application
cd C:\path\to\docMng_toShare

# Install dependencies (first time only)
pip install -r requirements.txt

# Start server
python app.py

# Stop server
Press Ctrl+C in Command Prompt

# Check if server is running
netstat -ano | findstr :5001
```

**End of User Guide**
