# README

## Introduction

This project automates human-like interactions with web pages using Node.js and Google Chrome. It simulates user behavior to navigate pages, input data, handle clicks, and interprets the page's accessibility tree to create a language model-friendly representation.

## Installation and Setup

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Run the Script**:

   ```bash
   node index.js
   ```

3. **Requirements**:

   - **Google Chrome** installed on your system.

## Key Technologies

### Human-like Interaction Functions

- **Text Input Simulation**: Inputs text character by character, mimicking human typing patterns for natural interaction.
- **Standard Click Events**: Performs click actions without artificial delays, as clicks are instantaneous in human behavior.

### Tab Management

- **Preventing New Tabs**: Intercepts attempts to open new tabs or windows, forcing all URLs to load in the current tab for a linear navigation flow.

### Accessibility Tree Parsing

- **DevTools Accessibility Tree**: Utilizes Chrome's DevTools Protocol to access the page's accessibility tree.
- **LLM-friendly Representation**: Parses the tree to extract a structured, semantic representation of the page suitable for language models.

#### Example Structure from `@a11y.txt`

An excerpt demonstrating the accessibility tree structure:

```text:debug/a11y.txt
RootWebArea[1](focusable, url=https://roame.travel/) Roame.Travel | Limited time award travel deals
  generic 
    main 
      link[60](focusable, url=https://roame.travel/) 
      link[106](focusable, url=https://roame.travel/skyview) SkyView Pro
        StaticText SkyView
        StaticText Pro
      link[3](focusable, url=https://roame.travel/discover) Discover
        StaticText Discover
      ...
```

- **Roles and Properties**: Elements like `link`, `StaticText`, and attributes such as `[focusable]`, `url`.
- **Hierarchy**: Indentation reflects parent-child relationships between elements.

### Assistant and Moderator Roles

- **Assistant Role**: Navigates web pages and performs actions based on the accessibility tree, simulating user interactions to achieve specific tasks.
- **Moderator Role**: Critiques each action and the overall interaction trajectory, providing feedback to improve the Assistant's performance.

#### Moderator Critique Process

- **Message Analysis**: Reviews the Assistant's inputs and actions for correctness and efficiency.
- **Trajectory Evaluation**: Assesses the logic and efficiency of navigation paths.
- **Feedback Loop**: Communicates improvements to refine future interactions.