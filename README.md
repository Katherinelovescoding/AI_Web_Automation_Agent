# AI Web Automation Agent

Tired of filling all kinds of forms? Don't want to type in your name, email, phone number, etc. again and again? **This AI Web Automation Agent can solve your problem.**

Give it a target URL and your data (name, email, address, …). The agent opens the page, finds the fields, fills them in, and submits the form for you. No more copy-pasting or re-typing.

## Features

- **Configurable target URL** — Set `TARGET_URL` in `.env` to any form page you want to automate (no hardcoded demo URL).
- **Agentic loop** — Uses an LLM (Gemini) with tools (e.g. `get_page_info`, `fill_field`, `select_option`, `screenshot`) to complete multi-section forms.
- **Dynamic variables** — Pass in form data (e.g. first name, last name, DOB, ID) at runtime or use defaults.
- **API & scheduling** — Can be run via API and on a schedule (e.g. every 5 minutes).

## Setup

### Requirements

- Node.js 20+

### Install

```bash
git clone <your-repo-url>
cd AI_Web_Automation_Agent
npm install
npx playwright install
```

### Environment

Copy `.env.example` to `.env` and set:

```bash
# Required: Gemini API key (get one at https://aistudio.google.com/apikey)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key

# Optional: URL of the form to automate (defaults to https://example.com)
TARGET_URL=https://your-form-page.example.com/
```

## Run

```bash
npm run dev
```

## Usage

- **Default run** — Uses `TARGET_URL` from `.env` and default variables (e.g. John Doe, 1990-01-01, id: "12345678", email: "john.doe@example.com"...).
- **Custom variables** — Call `main()` (or your API) with a partial `WorkflowVariables` object to override first name, last name, date of birth, id, email, passport number, phone, address, etc.
